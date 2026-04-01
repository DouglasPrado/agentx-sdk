# Hooks & Context Pipeline

Define o sistema de hooks, o pipeline de construcao de contexto, o context builder com compactacao e os guards de custo. Substitui o conceito de "middlewares HTTP" — este pacote nao tem HTTP.

---

## Pipeline de Execucao

> Em qual ordem as etapas internas executam durante `chat()` ou `stream()`?

<!-- do blueprint: 06-system-architecture.md, 07-critical_flows.md -->
```text
Invocacao (Agent.chat / Agent.stream)
  -> 1. ConfigValidation     (valida AgentConfig / ChatOptions via Zod)
  -> 2. ExecutionContext      (gera traceId, threadId, timing)
  -> 3. SessionCostGuard     (verifica budget da sessao)
  -> 4. ThreadMutex          (serializa thread atual via ConversationManager)
  -> 5. InputNormalization   (normaliza string -> ContentPart[])
  -> 6. ContextPipeline      (system -> skills -> knowledge -> memory -> history)
  -> 7. ExecutionCostGuard   (pre-check por iteracao do loop)
  -> 8. ReactLoop            (OpenRouter streaming + tool calling)
  -> 9. ToolHooks            (beforeToolCall / afterToolCall)
  -> 10. Persistence         (historico, memories, vectors)
  -> 11. EventSerializer     (formata AgentEvents publicos)
  -> 12. ErrorMapper         (normaliza excecoes e warnings)
Saida (AsyncIterableIterator<AgentEvent> ou string)
```

---

## AgentHooks

> Quais hooks o consumidor pode configurar?

**Interface:**

```typescript
interface AgentHooks {
  beforeToolCall?: (ctx: {
    tool: string;
    args: unknown;
  }) => Promise<{ block?: boolean; reason?: string } | void>;

  afterToolCall?: (ctx: {
    tool: string;
    result: string;
    isError: boolean;
  }) => Promise<{ result?: string } | void>;

  transformContext?: (messages: ChatMessage[]) => Promise<ChatMessage[]>;

  onEvent?: (event: AgentEvent) => void;
}
```

### Detalhamento

| Hook | Quando Executa | Pode Bloquear | Pode Modificar | Erro se Falhar |
| --- | --- | --- | --- | --- |
| `beforeToolCall` | Antes de executar cada tool | Sim (`block: true`) | Nao | `TOOL_BLOCKED` |
| `afterToolCall` | Apos resultado de cada tool | Nao | Sim (substituir `result`) | Warning no evento |
| `transformContext` | Antes de enviar mensagens ao LLM | Nao | Sim (mensagens) | `CONTEXT_PIPELINE_ERROR` |
| `onEvent` | A cada evento emitido | Nao | Nao | Silencioso (nao bloqueia) |

### Ordem no Fluxo de Tool Execution

```text
1. Zod valida args (estrutural)
2. tool.validate() se definido (semantica)
3. hooks.beforeToolCall → pode bloquear
4. tool.execute() roda
5. hooks.afterToolCall → pode modificar resultado
6. Resultado enviado ao LLM
```

---

## Context Pipeline

> Como o contexto e montado antes de enviar ao LLM?

**Arquivo:** `src/agent/core/context-pipeline.ts`

```typescript
class ContextPipeline {
  private stages: ContextStage[] = [];

  addStage(stage: ContextStage): void;
  async execute(frame: ContextFrame): Promise<ContextFrame>;
}
```

### Stages (ordem padrao)

| Ordem | Stage | Responsabilidade | Prioridade de Corte |
| --- | --- | --- | --- |
| 1 | `SystemPromptStage` | Injeta system prompt base | Nunca cortado |
| 2 | `SkillsStage` | Detecta skills ativas, injeta instrucoes | Ultima a ser cortada |
| 3 | `KnowledgeStage` | Busca RAG, injeta resultados | Cortada antes de skills |
| 4 | `MemoryStage` | Busca memorias relevantes | Cortada antes de knowledge |
| 5 | `HistoryStage` | Aplica windowing + compactacao | Compacta primeiro |

### ContextFrame

```typescript
interface ContextFrame {
  systemPrompt: string;
  messages: ChatMessage[];
  injections: ContextInjection[];
  tokenBudget: number;
  tokensUsed: number;
  metadata: Record<string, unknown>;
}

interface ContextInjection {
  source: 'skills' | 'knowledge' | 'memory' | 'system';
  priority: number;       // Maior = cortado por ultimo
  content: string;
  tokens: number;
}
```

### Resolucao de Budget

Quando o budget aperta, o pipeline corta injections por prioridade (menor prioridade primeiro):

1. Memorias com menor confidence
2. Chunks de knowledge com menor score
3. Instrucoes de skills (ultimo recurso)
4. System prompt nunca e cortado

---

## Context Builder

> Como o historico e compactado quando excede o budget?

**Arquivo:** `src/agent/core/context-builder.ts`

```typescript
class ContextBuilder {
  constructor(options?: {
    maxContextTokens?: number;    // Budget total (detectado por modelo)
    historyRatio?: number;        // default: 0.50
    injectionRatio?: number;      // default: 0.30
    reserveRatio?: number;        // default: 0.20
    compactionModel?: string;     // Modelo para sumarizar historico
  });

  build(params: BuildParams): { systemPrompt: string; messages: ChatMessage[] };
}
```

### Algoritmo de Compactacao

```text
1. Separa as ultimas 10 mensagens (preservadas intactas)
2. Identifica mensagens pinadas (preservadas intactas)
3. Sumariza mensagens antigas em 1-2 paragrafos via LLM
4. Injeta resumo como mensagem de sistema
5. Se nao houver LLM para compactacao, trunca as mais antigas
```

### Mensagens Pinadas

| Aspecto | Regra |
| --- | --- |
| Como pinar | `ChatOptions.pinned: true` |
| Nunca sumarizada | Sim |
| Limite de pinadas | 20 (configuravel via `conversation.maxPinnedMessages`) |
| Overflow de pinadas | As mais antigas perdem o pin |

---

## Cost Guards

> Como o custo e controlado durante a execucao?

### CostPolicy

```typescript
interface CostPolicy {
  maxTokensPerExecution?: number;     // Limite por chamada stream/chat
  maxTokensPerSession?: number;       // Limite acumulado na sessao
  maxToolCallsPerExecution?: number;  // Evitar loops infinitos
  onLimitReached: 'stop' | 'warn';   // 'stop' = aborta, 'warn' = continua com warning
}
```

### Pontos de Verificacao

| Guard | Quando Verifica | Acao ao Exceder |
| --- | --- | --- |
| `SessionCostGuard` | Inicio de cada execucao | `SESSION_COST_LIMIT_EXCEEDED` |
| `ExecutionCostGuard` | Antes de cada chamada ao LLM no loop | `EXECUTION_COST_LIMIT_EXCEEDED` |
| `ToolCallCounter` | Antes de cada tool call | Para o loop |
| `MaxIterations` | Antes de cada iteracao do ReactLoop | Para o loop (default: 10) |
| `MaxConsecutiveErrors` | Apos cada erro de tool | Para o loop (default: 3) |

---

## Etapas Condicionais

> Quais etapas so executam sob certas condicoes?

| Etapa | Condicao | Quando Nao Aplica |
| --- | --- | --- |
| `ToolHooks` | Existe tool call no turno | Turnos sem tool calls |
| `MemoryExtraction` | Triggers ou sampling ativo | Memory desabilitada ou rate nao atingido |
| `SkillsStage` | Skills registradas | Nenhuma skill configurada |
| `KnowledgeStage` | Knowledge habilitado | Knowledge desabilitado |
| `MCPHealthCheck` | Conexoes MCP ativas | Sem MCP configurado |

---

## Rate Limiting Interno

> Quais limites internos se aplicam por execucao?

| Escopo | Limite Padrao | Configuravel | Storage |
| --- | --- | --- | --- |
| Tokens por execucao | sem limite | `costPolicy.maxTokensPerExecution` | memoria da instancia |
| Tokens por sessao | sem limite | `costPolicy.maxTokensPerSession` | memoria da instancia |
| Tool calls por execucao | 20 | `costPolicy.maxToolCallsPerExecution` | memoria da instancia |
| Iteracoes do loop | 10 | `ReactLoopOptions.maxIterations` | memoria da instancia |
| Erros consecutivos | 3 | `ReactLoopOptions.maxConsecutiveErrors` | memoria da instancia |

> (ver [09-errors.md](09-errors.md) para como erros sao formatados e retornados)
