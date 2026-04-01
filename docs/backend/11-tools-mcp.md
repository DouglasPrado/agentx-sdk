# Tools & MCP

Define o sistema de tools (locais e remotas), o ToolExecutor, o MCPAdapter e o SkillManager. Este documento cobre tudo relacionado a extensibilidade do agente via ferramentas e habilidades.

---

## Visao Geral

> Quais componentes formam o sistema de tools?

<!-- do blueprint: 04-domain-model.md, 06-system-architecture.md -->
| Componente | Arquivo | Responsabilidade |
| --- | --- | --- |
| `AgentTool` | `src/agent/tools/tool-types.ts` | Interface de tool local |
| `ToolExecutor` | `src/agent/tools/tool-executor.ts` | Registro, validacao e execucao |
| `MCPAdapter` | `src/agent/tools/mcp-adapter.ts` | Bridge MCP → AgentTool |
| `AgentSkill` | `src/agent/skills/skill-types.ts` | Interface de skill |
| `SkillManager` | `src/agent/skills/skill-manager.ts` | Registro e matching de skills |

---

## AgentTool

> Como uma tool e definida?

```typescript
interface AgentToolResult {
  content: string;
  metadata?: Record<string, unknown>;
}

interface AgentTool<T = unknown> {
  name: string;
  description: string;
  parameters: z.ZodSchema<T>;
  execute: (args: T, signal?: AbortSignal) => Promise<string | AgentToolResult>;
  validate?: (args: T, context: ToolValidationContext) => Promise<ToolValidationResult>;
}
```

### Campos

| Campo | Tipo | Obrigatorio | Descricao |
| --- | --- | --- | --- |
| `name` | `string` | sim | Identificador unico (UPPER_SNAKE nao obrigatorio) |
| `description` | `string` | sim | Descricao para o LLM |
| `parameters` | `z.ZodSchema` | sim | Schema Zod dos argumentos |
| `execute` | `function` | sim | Funcao de execucao (recebe args validados + signal) |
| `validate` | `function` | nao | Validacao semantica opcional |

### Retorno

- `string` — retorno simples (texto direto ao LLM)
- `AgentToolResult` — retorno rico com metadata (duracao, custo, URLs)

---

## ToolExecutor

> Como tools sao registradas e executadas?

```typescript
class ToolExecutor {
  register(tool: AgentTool): void;
  unregister(name: string): void;
  getToolDefs(): ToolDef[];                    // Schemas JSON para o LLM
  async execute(calls: ToolCall[], signal?: AbortSignal): Promise<ToolResult[]>;
}
```

### Fluxo de Execucao

```text
1. LLM retorna tool_calls no stream
2. Para cada tool_call:
   a. Resolve tool por nome → ToolNotFoundError se nao existir
   b. Valida args via Zod schema → InvalidToolArgumentsError se falhar
   c. Executa tool.validate() se definido → erro semantico ao LLM
   d. Executa hooks.beforeToolCall → pode bloquear (ToolBlockedError)
   e. Executa tool.execute(args, signal) com timeout
   f. Executa hooks.afterToolCall → pode modificar resultado
   g. Retorna resultado como tool_result ao LLM
3. Proximo turno do ReactLoop
```

### Modos de Execucao

| Modo | Configuracao | Comportamento |
| --- | --- | --- |
| `parallel` | `ReactLoopOptions.toolExecution = 'parallel'` | Todas as tools do turno executam em paralelo via `Promise.all` |
| `sequential` | `ReactLoopOptions.toolExecution = 'sequential'` | Tools executam uma por vez, na ordem retornada pelo LLM |

### Tratamento de Erros de Tool

| Estrategia | Configuracao | Comportamento |
| --- | --- | --- |
| `continue` | `onToolError: 'continue'` | Envia erro como `tool_result` ao LLM, loop continua |
| `stop` | `onToolError: 'stop'` | Para o loop imediatamente |
| `retry` | `onToolError: 'retry'` | Re-executa a tool (max 1 retry), depois `continue` |

### Conversao Zod → JSON Schema

| Aspecto | Decisao |
| --- | --- |
| Biblioteca | `zod-to-json-schema` |
| Quando | No `getToolDefs()`, ao montar schemas para o LLM |
| Cache | Schemas sao convertidos uma vez e cacheados |

---

## Validacao Semantica de Tools

> Alem do Zod (estrutural), existe validacao de contexto?

```typescript
interface ToolValidationContext {
  userInput: string;
  conversationHistory: ChatMessage[];
  activeSkills: string[];
}

interface ToolValidationResult {
  valid: boolean;
  reason?: string;
  suggestion?: string;
}
```

| Etapa | Tipo | Falha |
| --- | --- | --- |
| 1. Zod schema | Estrutural | Erro imediato (`INVALID_TOOL_ARGUMENTS`) |
| 2. `tool.validate()` | Semantica | Motivo enviado ao LLM como tool_result de erro |
| 3. `beforeToolCall` hook | Politica | `TOOL_BLOCKED` |

---

## MCP Adapter

> Como servidores MCP sao conectados e suas tools expostas?

**Arquivo:** `src/agent/tools/mcp-adapter.ts`

```typescript
class MCPAdapter {
  async connect(config: MCPConnectionConfig): Promise<AgentTool[]>;
  async disconnect(): Promise<void>;
  async reconnect(): Promise<void>;
  isConnected(): boolean;
  getHealth(): MCPHealthStatus;
}
```

### MCPConnectionConfig

| Campo | Tipo | Obrigatorio | Default | Descricao |
| --- | --- | --- | --- | --- |
| `name` | `string` | sim | — | Identificador do server |
| `transport` | `'stdio' \| 'sse'` | sim | — | Protocolo de comunicacao |
| `command` | `string` | se stdio | — | Comando para iniciar o server |
| `args` | `string[]` | nao | `[]` | Argumentos do comando |
| `url` | `string` | se sse | — | URL do server SSE |
| `env` | `Record<string, string>` | nao | `{}` | Variaveis de ambiente |
| `timeout` | `number` | nao | `30_000` | Timeout por operacao (ms) |
| `maxRetries` | `number` | nao | `3` | Reconexao automatica |
| `healthCheckInterval` | `number` | nao | `60_000` | Heartbeat (0 = off) |
| `isolateErrors` | `boolean` | nao | `true` | Isolar falhas por tool |

### Dynamic Import

```typescript
// MCP SDK e importado dinamicamente
// Se nao instalado, erro amigavel:
// "Install @modelcontextprotocol/sdk to use MCP connections"
const sdk = await import('@modelcontextprotocol/sdk');
```

### MCPHealthStatus

```typescript
interface MCPHealthStatus {
  servers: Array<{
    name: string;
    status: 'connected' | 'disconnected' | 'error' | 'reconnecting';
    lastError?: string;
    toolCount: number;
    uptime: number;
  }>;
}
```

### Resiliencia MCP

| Cenario | Comportamento |
| --- | --- |
| Tool individual falha | Apenas ela retorna erro (se `isolateErrors: true`) |
| Server inteiro cai | Reconexao automatica com backoff |
| Reconexao falha apos maxRetries | Tools removidas do ToolExecutor |
| Timeout de tool | Erro na tool individual, outras continuam |
| SDK nao instalado | Erro amigavel na chamada a `connectMCP()` |

---

## Skills

> Como skills estendem o comportamento do agente?

### AgentSkill

```typescript
interface AgentSkill {
  name: string;
  description: string;
  instructions: string;        // Injetado no system prompt quando ativa
  tools?: AgentTool[];         // Tools exclusivas da skill
  match?: (input: string) => boolean;   // Matching customizado
  triggerPrefix?: string;       // Ex: "/review"
  priority?: number;           // Desempate (default: 0)
  exclusive?: boolean;         // Se true, bloqueia outras skills
}
```

### SkillManager

```typescript
class SkillManager {
  constructor(embeddingService?: EmbeddingService);

  register(skill: AgentSkill): void;
  match(input: string): ActiveSkill[];
}
```

### Estrategia de Matching (3 niveis)

| Nivel | Metodo | Exemplo | Prioridade |
| --- | --- | --- | --- |
| 1 | `triggerPrefix` | Input comeca com `/review` | Mais alta |
| 2 | `match()` customizado | Funcao do usuario retorna `true` | Media |
| 3 | Semantico via embeddings | Similaridade > 0.7 | Mais baixa |

### Desempate

```text
1. Skills exclusive: true tem prioridade absoluta
2. Entre nao-exclusivas, ordena por priority (desc)
3. Se empate, ordena por especificidade (prefix > custom > semantico)
4. Maximo de 3 skills ativas simultaneamente (configuravel)
```

### Cache de Embeddings

| Aspecto | Valor |
| --- | --- |
| Cache key | skill name |
| TTL | 24h (skills raramente mudam) |
| Storage | LRU em memoria |

---

## Registro e Lifecycle

> Como tools e skills sao gerenciadas no Agent?

| Operacao | Metodo | Efeito |
| --- | --- | --- |
| Registrar tool local | `Agent.addTool(tool)` | Disponivel para o LLM no proximo turno |
| Remover tool | `Agent.removeTool(name)` | Removida do ToolExecutor |
| Registrar skill | `Agent.addSkill(skill)` | Disponivel no SkillManager |
| Conectar MCP | `Agent.connectMCP(config)` | Tools MCP registradas no ToolExecutor |
| Desconectar MCP | `Agent.disconnectMCP()` | Tools MCP removidas |
| Destruir Agent | `Agent.destroy()` | Desconecta MCP, fecha stores, limpa caches |

### Trust Boundaries

| Ator | Pode Registrar | Pode Executar | Pode Bloquear |
| --- | --- | --- | --- |
| Consumidor (host app) | Tools, skills, MCP | Indiretamente via Agent API | Via hooks |
| LLM | Nao | Solicita via tool_calls | Nao |
| Tool | Nao | Apenas seu proprio codigo | Nao |
| MCP Server | Nao (tools sao bridge) | Via MCPAdapter | Nao |

> (ver [12-events.md](12-events.md) para eventos emitidos durante tool execution)
