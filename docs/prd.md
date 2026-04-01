# Plano: Implementar Pure Agent — Pacote Standalone

## Contexto

Criar um agente conversacional puro com OOP em `src/agent/`, **100% independente** do dify-agent (sem imports internos). Conecta apenas ao OpenRouter. Suporta: Knowledge/RAG, Memory com aprendizado, Tools, MCP, Skills. Streamable via `AsyncIterableIterator<AgentEvent>`.

## Avaliacao pi-agent-core

**Decisao: NAO usar.**

O `@mariozechner/pi-agent-core` (v0.64.0) oferece agent loop + eventos + tool execution, mas:

1. **Deps pesadas**: `@mariozechner/pi-ai` traz OpenAI SDK + Anthropic SDK + Google GenAI SDK + TypeBox + AJV — nos so precisamos de `fetch()` para OpenRouter
2. **Schema incompativel**: Usa `@sinclair/typebox` — nos usamos Zod (regra do CLAUDE.md)
3. **Loop simples**: O ReAct loop sao ~200 linhas — nao justifica a dependencia
4. **70% fora**: Memory, Knowledge, Skills, MCP, Context Builder — tudo precisa ser construido de qualquer forma
5. **Versao 0.x instavel** de um unico mantenedor

**Inspiracoes aproveitadas**: Eventos granulares (turn_start/end), hooks beforeToolCall/afterToolCall, transformContext, toolExecution parallel/sequential, steering messages.

## Dependencias (minimas)

```
zod                           # Validacao de schemas
better-sqlite3                # SQLite embutido (memoria, knowledge, conversas)
@modelcontextprotocol/sdk     # MCP protocol (opcional, so se usar MCP)
zod-to-json-schema            # Converter Zod → JSON Schema para function calling
```

Zero frameworks de IA. HTTP via `fetch()` nativo (Node 18+). Persistencia local via SQLite (zero config, sem servidor).

## Estrutura de Arquivos (30 arquivos)

```
src/agent/
├── index.ts                          # Exports publicos
├── agent.ts                          # Classe Agent principal
├── types.ts                          # Tipos centrais (AgentEvent, Memory, etc.)
├── config.ts                         # AgentConfig com Zod
├── llm/
│   ├── openrouter-client.ts          # HTTP + SSE streaming direto
│   ├── message-types.ts              # ChatMessage, StreamChunk, ToolCall (multimodal)
│   └── reasoning.ts                  # buildReasoningArgs() por familia
├── core/
│   ├── react-loop.ts                 # Loop ReAct puro (com error recovery)
│   ├── stream-emitter.ts             # Async push/pull channel (com backpressure)
│   ├── context-builder.ts            # System prompt + budget + compactacao
│   ├── context-pipeline.ts           # Pipeline explicito de construcao de contexto
│   ├── conversation-manager.ts       # Isolamento de threads + persistencia + mutex
│   └── execution-context.ts          # TraceId + correlacao de eventos
├── storage/
│   └── sqlite-database.ts            # Wrapper SQLite (auto-create tables, migrations)
├── memory/
│   ├── memory-manager.ts             # Extracao + recall + feedback (event-driven + sampling)
│   ├── memory-store.ts               # Interface MemoryStore
│   └── sqlite-memory-store.ts        # Store padrao SQLite (persistente, busca FTS5 + embeddings)
├── knowledge/
│   ├── knowledge-manager.ts          # RAG: ingest + search
│   ├── chunking.ts                   # Estrategias de chunking (fixed, semantic, recursive)
│   ├── vector-store.ts               # Interface VectorStore + SQLiteVectorStore
│   └── embedding-service.ts          # Embeddings via OpenRouter (com cache)
├── tools/
│   ├── tool-types.ts                 # Interface AgentTool (retorno rico)
│   ├── tool-executor.ts              # Registro + validacao Zod + execucao (parallel/sequential)
│   └── mcp-adapter.ts               # MCP → AgentTool (dynamic import, reconnect, fault isolation)
├── skills/
│   ├── skill-types.ts                # Interface AgentSkill (com prioridade)
│   └── skill-manager.ts             # Registro + matching (prefix + semantico + desempate)
└── utils/
    ├── logger.ts                     # Logger minimo (console)
    ├── token-counter.ts              # Estimativa de tokens (i18n-aware)
    ├── retry.ts                      # Retry com backoff
    └── cache.ts                      # Cache LRU com TTL (embeddings, knowledge)
```

## Ordem de Implementacao

### Fase 1: Fundacao (tipos + LLM + utils)

1. `src/agent/types.ts` — AgentEvent, Memory, RetrievedKnowledge, TokenUsage, ContentPart, ExecutionContext
2. `src/agent/utils/logger.ts` — Logger console-based com levels
3. `src/agent/utils/token-counter.ts` — Estimativa tokens (i18n-aware: latin ~4, CJK ~1.5)
4. `src/agent/utils/retry.ts` — Retry exponential backoff
5. `src/agent/utils/cache.ts` — Cache LRU com TTL
6. `src/agent/llm/message-types.ts` — ChatMessage (multimodal content), StreamChunk, ToolCallDelta, responseFormat
7. `src/agent/llm/reasoning.ts` — buildReasoningArgs por familia de modelo
8. `src/agent/config.ts` — AgentConfig Zod schema (com cost budget, determinism, sampling)
9. `src/agent/llm/openrouter-client.ts` — fetch + SSE parsing + embeddings + structured output

### Fase 2: Subsistemas

10. `src/agent/tools/tool-types.ts` — AgentTool interface (retorno AgentToolResult rico)
11. `src/agent/tools/tool-executor.ts` — Registro + execucao + Zod→JSON Schema + parallel/sequential
12. `src/agent/tools/mcp-adapter.ts` — MCP SDK → AgentTool[] (dynamic import, reconnect, fault isolation)
13. `src/agent/storage/sqlite-database.ts` — Wrapper SQLite (auto-create, migrations, WAL mode)
14. `src/agent/memory/memory-store.ts` — Interface MemoryStore
15. `src/agent/memory/sqlite-memory-store.ts` — SQLiteMemoryStore (FTS5 full-text search + embeddings)
16. `src/agent/memory/memory-manager.ts` — Extracao event-driven + recall + feedback + decay + consolidacao
17. `src/agent/knowledge/chunking.ts` — Estrategias de chunking (fixed-size, recursive character)
18. `src/agent/knowledge/vector-store.ts` — Interface VectorStore + SQLiteVectorStore (cosseno em SQLite)
19. `src/agent/knowledge/embedding-service.ts` — embed() via OpenRouter (com cache LRU)
20. `src/agent/knowledge/knowledge-manager.ts` — ingest (com chunking) + search (com cache)
21. `src/agent/skills/skill-types.ts` — AgentSkill interface (com prioridade)
22. `src/agent/skills/skill-manager.ts` — Registro + matching (prefix + semantico + desempate)

### Fase 3: Core (loop + contexto + agent)

22. `src/agent/core/execution-context.ts` — TraceId + correlacao de eventos + timing
23. `src/agent/core/stream-emitter.ts` — Push/pull async channel (bounded queue, backpressure)
24. `src/agent/core/conversation-manager.ts` — Isolamento de threads (Map + mutex + persistencia)
25. `src/agent/core/context-pipeline.ts` — Pipeline explicito: skills → knowledge → memory → history
26. `src/agent/core/context-builder.ts` — System prompt com budget + compactacao + mensagens pinadas
27. `src/agent/core/react-loop.ts` — Loop ReAct com streaming + error recovery + cost guard
28. `src/agent/agent.ts` — Classe Agent (chat + stream + lifecycle + cost enforcement)
29. `src/agent/index.ts` — Re-exports

## Design das Classes Principais

### Agent (ponto de entrada)

```typescript
class Agent {
  private conversations: ConversationManager;
  private costAccumulator: { inputTokens: number; outputTokens: number };

  constructor(config: AgentConfig);

  // API principal — ChatOptions permite override de model e systemPrompt por chamada
  async chat(
    input: string | ContentPart[],
    options?: ChatOptions,
  ): Promise<string>;
  stream(
    input: string | ContentPart[],
    options?: ChatOptions,
  ): AsyncIterableIterator<AgentEvent>;

  // Tools & Skills
  addTool(tool: AgentTool): void;
  removeTool(name: string): void;
  addSkill(skill: AgentSkill): void;
  async connectMCP(config: MCPConnectionConfig): Promise<void>;
  async disconnectMCP(): Promise<void>;

  // Memory
  async remember(fact: string, scope?: MemoryScope): Promise<void>;
  async recall(query: string): Promise<Memory[]>;
  async feedback(
    turnIndex: number,
    rating: "positive" | "negative",
    comment?: string,
  ): Promise<void>;

  // Knowledge
  async ingestKnowledge(doc: KnowledgeDocument): Promise<void>;

  // Observabilidade
  getUsage(): TokenUsage; // Custo acumulado da sessao
  getHistory(threadId?: string): ChatMessage[];

  // Lifecycle
  async destroy(): Promise<void>;
}
```

### ChatOptions (com overrides por request)

```typescript
interface ChatOptions {
  signal?: AbortSignal;
  threadId?: string; // Isolamento de conversa (default: "default")
  model?: string; // Override do modelo para esta chamada
  systemPrompt?: string; // Override do system prompt para esta chamada
  temperature?: number; // Override de temperature
  responseFormat?: ResponseFormat; // Structured output (json_object, json_schema)
  metadata?: Record<string, unknown>;
}

type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; schema: Record<string, unknown>; name: string };
```

### ContentPart (multimodal)

```typescript
type ContentPart =
  | { type: "text"; text: string }
  | {
      type: "image_url";
      image_url: { url: string; detail?: "auto" | "low" | "high" };
    };
```

### OpenRouterClient (HTTP nativo)

```typescript
class OpenRouterClient {
  constructor(config: { apiKey: string; model: string; baseUrl?: string });
  async *streamChat(
    params: StreamChatParams,
  ): AsyncIterableIterator<StreamChunk>;
  async chat(params: ChatParams): Promise<ChatResponse>;
  async embed(texts: string[], model?: string): Promise<number[][]>;
}
```

StreamChatParams inclui `responseFormat?` para structured output e `content` aceita `string | ContentPart[]` para multimodal.

### SQLiteDatabase (storage/sqlite-database.ts)

Wrapper centralizado para SQLite. Usado por MemoryStore, VectorStore e ConversationStore. Um unico arquivo `.db` para tudo.

```typescript
class SQLiteDatabase {
  constructor(options?: {
    path?: string; // default: '~/.agent/data.db' (ou ':memory:' para testes)
    walMode?: boolean; // default: true (melhor performance concorrente)
  });

  // Acesso ao banco
  get db(): BetterSqlite3.Database;

  // Auto-create tables na primeira execucao
  initialize(): void;

  // Fechar conexao
  close(): void;
}
```

**Tabelas criadas automaticamente**:

```sql
-- Memorias
CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  scope TEXT NOT NULL,              -- 'thread' | 'persistent' | 'learned'
  category TEXT NOT NULL,           -- 'fact' | 'preference' | 'procedure' | 'insight' | 'context'
  confidence REAL NOT NULL DEFAULT 0.8,
  access_count INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'extracted',
  thread_id TEXT,
  embedding BLOB,                  -- Float32Array serializado
  created_at INTEGER NOT NULL,
  last_accessed_at INTEGER NOT NULL
);
CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(content, content=memories, content_rowid=rowid);

-- Knowledge (vetores)
CREATE TABLE IF NOT EXISTS vectors (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  embedding BLOB NOT NULL,          -- Float32Array serializado
  metadata TEXT,                    -- JSON
  created_at INTEGER NOT NULL
);

-- Conversas
CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  tool_calls TEXT,                  -- JSON
  tool_call_id TEXT,
  pinned INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_conversations_thread ON conversations(thread_id, created_at);
```

**Vantagens sobre in-memory**:

- Dados sobrevivem restart do processo
- FTS5 para busca full-text em memorias (muito mais rapido que keyword match)
- WAL mode para leitura concorrente sem locks
- Arquivo unico, zero config, sem servidor
- SQLite e embutido — nao precisa instalar nada alem do pacote npm

### ConversationManager (isolamento de threads)

```typescript
class ConversationManager {
  // Historico isolado por threadId
  getHistory(threadId: string): ChatMessage[];
  addMessage(threadId: string, message: ChatMessage): void;
  clearThread(threadId: string): void;
  listThreads(): string[];

  // Persistencia opcional — se um ConversationStore for fornecido
  async save(threadId: string): Promise<void>;
  async load(threadId: string): Promise<void>;
}

// Interface plugavel para persistencia
interface ConversationStore {
  save(threadId: string, messages: ChatMessage[]): Promise<void>;
  load(threadId: string): Promise<ChatMessage[]>;
  delete(threadId: string): Promise<void>;
  list(): Promise<string[]>;
}
```

Default: SQLite (persistente, zero config). Usuarios podem implementar PostgresStore, RedisStore, etc.

### ReactLoop (sem framework, com error recovery)

```typescript
class ReactLoop {
  constructor(
    llm: OpenRouterClient,
    toolExecutor: ToolExecutor,
    options: ReactLoopOptions,
  );
  async *execute(
    systemPrompt: string,
    messages: ChatMessage[],
    tools: ToolDef[],
  ): AsyncIterableIterator<AgentEvent>;
}

interface ReactLoopOptions {
  maxIterations: number; // default: 10
  timeout: number; // default: 120_000ms
  toolExecution: "parallel" | "sequential"; // default: 'parallel'
  hooks?: AgentHooks;
  onToolError: "continue" | "stop" | "retry"; // default: 'continue'
  maxConsecutiveErrors: number; // default: 3 — para loop apos N erros seguidos
}
```

Algoritmo com error recovery:

1. streamChat(messages, tools) ao LLM
2. Se `finish_reason === 'length'` → yield warning, truncar resposta
3. Se tool_calls:
   a. beforeToolCall hook → pode bloquear
   b. Executar tools (parallel ou sequential conforme config)
   c. Se tool lanca excecao → yield `tool_call_end` com `isError: true`
   - `onToolError: 'continue'` → envia erro como tool_result ao LLM, continua loop
   - `onToolError: 'stop'` → para o loop
   - `onToolError: 'retry'` → re-executa a tool (max 1 retry)
     d. afterToolCall hook → pode modificar resultado
     e. Append results → volta a 1
4. Se texto puro → yield text_delta events → fim
5. Se maxConsecutiveErrors atingido → yield error, para loop
6. yield `agent_end` com usage acumulado

### AgentEvent (tipos de evento)

```typescript
type AgentEvent =
  | { type: "agent_start" }
  | { type: "agent_end"; usage: TokenUsage; duration: number }
  | { type: "turn_start"; iteration: number }
  | { type: "turn_end"; iteration: number }
  | { type: "thinking"; data: string }
  | { type: "text_delta"; data: string }
  | { type: "text_done"; fullText: string }
  | {
      type: "tool_call_start";
      id: string;
      tool: string;
      args: Record<string, unknown>;
    }
  | {
      type: "tool_call_end";
      id: string;
      tool: string;
      result: string;
      isError: boolean;
      duration: number;
    }
  | { type: "memory_extracted"; memories: Memory[] }
  | { type: "knowledge_retrieved"; sources: RetrievedKnowledge[] }
  | { type: "skill_activated"; skill: string }
  | { type: "warning"; message: string; code?: string } // truncamento, rate limit, etc.
  | { type: "error"; error: string; code?: string };
```

### Hooks (inspirados em pi-agent-core)

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

### AgentTool (retorno rico)

```typescript
interface AgentToolResult {
  content: string; // Texto retornado ao LLM
  metadata?: Record<string, unknown>; // Dados extras (duracao, custo, URLs, etc.)
}

interface AgentTool<T = unknown> {
  name: string;
  description: string;
  parameters: z.ZodSchema<T>;
  execute: (args: T, signal?: AbortSignal) => Promise<string | AgentToolResult>;
}
```

- `execute` pode retornar `string` (simples) ou `AgentToolResult` (rico) — ambos aceitos
- Recebe `signal` para suportar cancelamento mid-tool

### MemoryManager (com sampling e modelo dedicado)

```typescript
class MemoryManager {
  constructor(
    store: MemoryStore,
    llm: OpenRouterClient,
    options?: {
      extractionRate?: number; // 0-1, default 0.3 (30% dos turnos)
      extractionModel?: string; // Modelo barato para extracao (default: usa o mesmo)
      maxMemories?: number; // Limite de memorias por scope
    },
  );
}
```

### MemoryStore (plugavel)

```typescript
interface MemoryStore {
  save(memory: Memory): Promise<void>;
  search(query: string, limit?: number): Promise<Memory[]>;
  list(scope?: MemoryScope): Promise<Memory[]>;
  delete(id: string): Promise<void>;
  update(id: string, updates: Partial<Memory>): Promise<void>;
}
```

Default: SQLiteMemoryStore. Dados persistidos em `~/.agent/data.db` (configuravel).

### SQLiteMemoryStore (implementacao padrao)

```typescript
class SQLiteMemoryStore implements MemoryStore {
  constructor(db: SQLiteDatabase, embeddingService?: EmbeddingService);

  // search() usa estrategia hibrida:
  // 1. Se EmbeddingService disponivel → busca por similaridade cosseno nos embeddings
  // 2. Sempre faz FTS5 full-text search como complemento
  // 3. Combina resultados com Reciprocal Rank Fusion (RRF)
  // 4. Ordena por score combinado * confidence

  // save() gera embedding automaticamente se EmbeddingService disponivel
  // update() recalcula embedding se content mudou
}
```

**Busca FTS5** (sem custo de API, sem latencia):

```sql
SELECT * FROM memories_fts WHERE memories_fts MATCH ? ORDER BY rank LIMIT ?
```

**Busca hibrida** (quando embeddings disponiveis):

- FTS5 retorna top-K por relevancia textual
- Cosine similarity retorna top-K por semantica
- RRF combina os dois rankings em score unico
- Resultado: melhor recall que qualquer metodo isolado

### VectorStore (plugavel)

```typescript
interface VectorStore {
  upsert(
    id: string,
    embedding: number[],
    metadata: Record<string, unknown>,
    content: string,
  ): Promise<void>;
  search(embedding: number[], topK: number): Promise<VectorSearchResult[]>;
  delete(id: string): Promise<void>;
}
```

Default: SQLiteVectorStore. Usuarios podem implementar PgVectorStore, PineconeStore, etc.

### SQLiteVectorStore (implementacao padrao)

```typescript
class SQLiteVectorStore implements VectorStore {
  constructor(db: SQLiteDatabase);

  // upsert() armazena embedding como Float32Array → Buffer (BLOB)
  // search() carrega todos os embeddings e calcula cosseno em JS
  //   — para <100K vetores, performance aceitavel (~50ms para 50K vetores)
  //   — para volumes maiores, usuario deve plugar PgVectorStore ou similar

  // Otimizacao: cache de embeddings em memoria (LRUCache) para evitar I/O repetido
}
```

**Calculo de similaridade cosseno**:

```typescript
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

### Chunking (estrategias de divisao de documentos)

```typescript
interface ChunkingStrategy {
  chunk(text: string): ChunkResult[];
}

interface ChunkResult {
  content: string;
  index: number;
  metadata: { start: number; end: number };
}

// Implementacoes incluidas:
// - FixedSizeChunking(chunkSize: 512, overlap: 50)    — divide por tamanho fixo com overlap
// - RecursiveCharacterChunking(maxSize: 1000)          — divide por separadores (\n\n, \n, ., " ")
```

### ContextBuilder (com compactacao)

```typescript
class ContextBuilder {
  constructor(options?: {
    maxContextTokens?: number; // Budget total (default: detectado por modelo)
    historyRatio?: number; // default: 0.50
    injectionRatio?: number; // default: 0.30
    reserveRatio?: number; // default: 0.20
    compactionModel?: string; // Modelo para sumarizar historico antigo
  });

  build(params: BuildParams): { systemPrompt: string; messages: ChatMessage[] };
}
```

Quando o historico excede o budget de history:

1. Separa as ultimas 10 mensagens (preservadas intactas)
2. Sumariza as mensagens anteriores em 1-2 paragrafos via LLM
3. Injeta o resumo como mensagem de sistema
4. Se nao houver LLM para compactacao, simplesmente trunca as mais antigas

### MCPAdapter (dynamic import)

```typescript
class MCPAdapter {
  // Usa import() dinamico — se @modelcontextprotocol/sdk nao estiver instalado,
  // lanca erro amigavel: "Install @modelcontextprotocol/sdk to use MCP connections"
  async connect(config: MCPConnectionConfig): Promise<AgentTool[]>;
  async disconnect(): Promise<void>;
  isConnected(): boolean;
}
```

### SkillManager (matching semantico + desempate)

```typescript
class SkillManager {
  constructor(embeddingService?: EmbeddingService);

  register(skill: AgentSkill): void;
  match(input: string): ActiveSkill[]; // Matching em 3 niveis:
  // 1. triggerPrefix (ex: "/review") → match direto
  // 2. match() customizado → funcao do usuario
  // 3. Semantico via embeddings (se EmbeddingService disponivel) → similaridade > 0.7
}

interface AgentSkill {
  name: string;
  description: string;
  instructions: string;
  tools?: AgentTool[];
  match?: (input: string) => boolean;
  triggerPrefix?: string;
  priority?: number; // Desempate: maior prioridade vence (default: 0)
  exclusive?: boolean; // Se true, bloqueia outras skills quando ativa
}
```

**Estrategia de desempate quando multiplas skills matcham**:

1. Skills com `exclusive: true` tem prioridade absoluta (so uma ativa)
2. Entre nao-exclusivas, ordena por `priority` (desc)
3. Se empate de prioridade, ordena por especificidade (prefix > custom > semantico)
4. Maximo de 3 skills ativas simultaneamente (configuravel)

---

## Endurecimento para Producao

### 1. Pipeline Explicito de Contexto (context-pipeline.ts)

O `Agent` nao monta contexto diretamente. Existe um pipeline explicito com etapas ordenadas e orquestrador dedicado:

```typescript
class ContextPipeline {
  private stages: ContextStage[] = [];

  // Etapas executam em ordem, cada uma recebe e retorna ContextFrame
  addStage(stage: ContextStage): void;

  async execute(frame: ContextFrame): Promise<ContextFrame>;
}

interface ContextStage {
  name: string;
  priority: number; // Ordem de execucao (menor = primeiro)
  execute(frame: ContextFrame): Promise<ContextFrame>;
}

interface ContextFrame {
  systemPrompt: string;
  messages: ChatMessage[];
  injections: ContextInjection[]; // Cada subsistema injeta aqui
  tokenBudget: number;
  tokensUsed: number;
  metadata: Record<string, unknown>;
}

interface ContextInjection {
  source: "skills" | "knowledge" | "memory" | "system";
  priority: number; // Maior prioridade = cortado por ultimo
  content: string;
  tokens: number;
}
```

**Pipeline padrao** (5 etapas em ordem):

1. `SystemPromptStage` — Injeta system prompt base
2. `SkillsStage` — Detecta skills ativas, injeta instrucoes (prioridade mais alta)
3. `KnowledgeStage` — Busca RAG, injeta resultados
4. `MemoryStage` — Busca memorias relevantes, injeta contexto
5. `HistoryStage` — Aplica windowing + compactacao ao historico

Quando o budget aperta, o pipeline corta injections por prioridade (memoria e knowledge primeiro, skills por ultimo). Isso resolve o conflito entre subsistemas — quem orquestra e o pipeline, nao o Agent.

### 2. Controle Ativo de Custo (cost guard)

```typescript
interface CostPolicy {
  maxTokensPerExecution?: number; // Limite por chamada stream/chat
  maxTokensPerSession?: number; // Limite acumulado na sessao do Agent
  maxToolCallsPerExecution?: number; // Evitar loops infinitos de tools
  onLimitReached: "stop" | "warn"; // 'stop' = aborta, 'warn' = yield warning e continua
}
```

Integrado no `ReactLoop`:

- Antes de cada chamada ao LLM, verifica `tokensUsed + estimatedCost < maxTokensPerExecution`
- Se ultrapassar com `onLimitReached: 'stop'` → yield `agent_end` com `reason: 'cost_limit'`
- Se `'warn'` → yield `warning` event e continua (1 vez por limite)
- Contabiliza tool calls: se `maxToolCallsPerExecution` atingido, para o loop

```typescript
// Exemplo de uso
const agent = new Agent({
  apiKey: "...",
  model: "...",
  costPolicy: {
    maxTokensPerExecution: 50_000,
    maxTokensPerSession: 500_000,
    maxToolCallsPerExecution: 20,
    onLimitReached: "stop",
  },
});
```

### 3. Mensagens Pinadas (nao compactaveis)

```typescript
interface ChatOptions {
  // ... campos existentes ...
  pinned?: boolean; // Marca esta mensagem como nao compactavel
}

// Internamente no ContextBuilder:
interface PinnedMessage {
  message: ChatMessage;
  reason?: string; // Por que esta mensagem e critica
}
```

O `ContextBuilder` ao compactar historico:

1. **Nunca** sumariza mensagens com `pinned: true`
2. Preserva as ultimas 10 mensagens (regra existente)
3. Mensagens pinadas mais antigas ficam intactas entre o resumo e as recentes
4. Limite de mensagens pinadas: 20 (configuravel) — acima disso, as mais antigas perdem o pin

```typescript
// Exemplo de uso
await agent.chat("IMPORTANTE: meu deadline e dia 15/04", { pinned: true });
// ... 50 mensagens depois ...
await agent.chat("Qual meu deadline?"); // → 15/04 (mensagem pinada preservada)
```

### 4. Memoria Event-Driven + Decay

O `MemoryManager` nao depende apenas de sampling aleatorio. Usa abordagem hibrida:

```typescript
class MemoryManager {
  constructor(
    store: MemoryStore,
    llm: OpenRouterClient,
    options?: {
      extractionRate?: number; // Sampling base: 0.3 (30% dos turnos)
      extractionModel?: string; // Modelo barato para extracao
      maxMemories?: number; // Limite por scope
      decayInterval?: number; // A cada N turnos, aplica decay (default: 50)
      decayFactor?: number; // Multiplicador de confidence (default: 0.95)
      minConfidence?: number; // Memorias abaixo disso sao removidas (default: 0.1)
    },
  );

  // Extracao inteligente — nao apenas sampling aleatorio
  async shouldExtract(messages: ChatMessage[]): Promise<boolean>;
}
```

**Triggers de extracao** (event-driven, alem do sampling):

- Usuario diz explicitamente algo factual ("Meu nome e...", "Eu prefiro...", "Lembra que...")
- Conversa tem mais de 10 turnos sem extracao
- Tool execution gerou resultado significativo
- Feedback positivo recebido

**Ciclo de vida da memoria**:

1. **Criacao**: confidence = 0.8 (extraida) ou 1.0 (usuario explicito)
2. **Acesso**: confidence += 0.05 (reforco por uso)
3. **Decay**: a cada N turnos, `confidence *= decayFactor` para memorias nao acessadas
4. **Limpeza**: memorias com `confidence < minConfidence` sao removidas automaticamente
5. **Consolidacao**: memorias similares sao mergeadas (dedup semantica periodica)

### 5. Validacao Semantica de Tools

Alem da validacao Zod (estrutural), existe uma camada de validacao semantica opcional:

```typescript
interface AgentTool<T = unknown> {
  // ... campos existentes ...
  validate?: (
    args: T,
    context: ToolValidationContext,
  ) => Promise<ToolValidationResult>;
}

interface ToolValidationContext {
  userInput: string; // Input original do usuario
  conversationHistory: ChatMessage[]; // Ultimas N mensagens
  activeSkills: string[]; // Skills ativas
}

interface ToolValidationResult {
  valid: boolean;
  reason?: string; // Se invalido, motivo
  suggestion?: string; // Sugestao de correcao para o LLM
}
```

Fluxo no `ToolExecutor`:

1. Zod valida estrutura → se falhar, erro imediato
2. `tool.validate()` (se definido) verifica semantica → se falhar, envia motivo ao LLM como tool_result de erro
3. `beforeToolCall` hook → pode bloquear
4. `tool.execute()` roda

```typescript
// Exemplo: tool que so deve ser usada para consultas, nao acoes
const searchTool: AgentTool<{ query: string }> = {
  name: "search_docs",
  description: "Search documentation",
  parameters: z.object({ query: z.string() }),
  validate: async (args, ctx) => {
    if (ctx.userInput.includes("delete") || ctx.userInput.includes("remove")) {
      return {
        valid: false,
        reason: "This tool is read-only, cannot modify data",
      };
    }
    return { valid: true };
  },
  execute: async ({ query }) => `Results for: ${query}`,
};
```

### 6. MCP Robustez Operacional

```typescript
class MCPAdapter {
  async connect(config: MCPConnectionConfig): Promise<AgentTool[]>;
  async disconnect(): Promise<void>;
  isConnected(): boolean;

  // Novas capacidades operacionais:
  async reconnect(): Promise<void>; // Reconexao manual
  getHealth(): MCPHealthStatus; // Status de cada server
}

interface MCPConnectionConfig {
  name: string;
  transport: "stdio" | "sse";
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  // Novas opcoes operacionais:
  timeout?: number; // Timeout por operacao (default: 30_000ms)
  maxRetries?: number; // Reconexao automatica (default: 3)
  healthCheckInterval?: number; // Intervalo de heartbeat (default: 60_000ms, 0 = desabilitado)
  isolateErrors?: boolean; // Se true, falha de 1 tool nao afeta outras do mesmo server
}

interface MCPHealthStatus {
  servers: Array<{
    name: string;
    status: "connected" | "disconnected" | "error" | "reconnecting";
    lastError?: string;
    toolCount: number;
    uptime: number;
  }>;
}
```

**Isolamento de falhas**:

- Cada tool MCP roda com seu proprio timeout
- Se uma tool trava, apenas ela retorna erro — as outras tools do mesmo server continuam funcionando
- Se o server inteiro cai, reconexao automatica com backoff
- Tools de servers desconectados sao removidas do ToolExecutor ate reconexao

### 7. Concorrencia Segura (mutex no ConversationManager)

```typescript
class ConversationManager {
  // Mutex por thread — garante que duas chamadas simultaneas ao mesmo threadId
  // nao corrompam o historico
  private locks: Map<string, Promise<void>>;

  // Operacao atomica: adquire lock, executa, libera
  async withThread<T>(
    threadId: string,
    fn: (history: ChatMessage[]) => Promise<T>,
  ): Promise<T>;

  // Metodos existentes continuam, mas usam o mutex internamente
  getHistory(threadId: string): ChatMessage[];
  addMessage(threadId: string, message: ChatMessage): void;
}
```

O `Agent` usa `withThread()` para garantir que execucoes concorrentes no mesmo thread sao serializadas:

```typescript
// Interno do Agent.stream():
await this.conversations.withThread(threadId, async (history) => {
  // Toda a execucao do ReactLoop acontece dentro do lock
  // Outra chamada ao mesmo threadId espera esta terminar
});
```

Para threads **diferentes**, execucao e totalmente paralela (locks independentes).

### 8. Cache LRU com TTL (utils/cache.ts)

```typescript
class LRUCache<K, V> {
  constructor(options: { maxSize: number; ttlMs: number });

  get(key: K): V | undefined;
  set(key: K, value: V): void;
  has(key: K): boolean;
  delete(key: K): void;
  clear(): void;
  get size(): number;
}
```

**Onde e usado**:

- `EmbeddingService`: cache de embeddings por texto (evita recalcular para textos identicos)
  - Cache key: hash do texto, TTL: 1h, maxSize: 10_000
- `KnowledgeManager`: cache de resultados de busca por query
  - Cache key: query normalizada, TTL: 5min, maxSize: 500
- `SkillManager`: cache de embeddings de skill descriptions
  - Cache key: skill name, TTL: 24h (raramente mudam)

**Impacto**: Em conversas repetitivas ou com knowledge fixo, reduz chamadas de embedding em ~60-80%.

### 9. Observabilidade — ExecutionContext (trace)

Cada chamada `chat()` ou `stream()` gera um `ExecutionContext` com ID unico que acompanha todos os eventos:

```typescript
interface ExecutionContext {
  traceId: string; // UUID unico por execucao
  threadId: string; // Thread da conversa
  startedAt: number; // Timestamp de inicio
  model: string; // Modelo usado nesta execucao
  parentTraceId?: string; // Para sub-execucoes (ex: memory extraction)
}
```

Todos os `AgentEvent` passam a incluir o traceId:

```typescript
type AgentEvent =
  | { type: "agent_start"; traceId: string }
  | { type: "agent_end"; traceId: string; usage: TokenUsage; duration: number }
  | { type: "turn_start"; traceId: string; iteration: number };
// ... todos os eventos incluem traceId
```

Permite:

- Correlacionar todos os eventos de uma unica execucao
- Diferenciar eventos de execucoes concorrentes
- Medir latencia end-to-end e por etapa
- Integrar com sistemas de tracing externos (OpenTelemetry, Datadog, etc.)

```typescript
// Exemplo: logging estruturado
agent.stream("Hello", {
  hooks: {
    onEvent: (event) => {
      console.log(
        JSON.stringify({
          traceId: event.traceId,
          type: event.type,
          timestamp: Date.now(),
          ...event,
        }),
      );
    },
  },
});
```

### 10. Determinismo Configuravel

```typescript
interface AgentConfig {
  // ... campos existentes ...
  deterministic?:
    | boolean
    | {
        seed?: number; // Seed fixa para o LLM (OpenRouter suporta)
        temperature?: 0; // Forca temperature 0
        topP?: 1; // Forca top_p 1
        disableMemoryExtraction?: boolean; // Desabilita extracao (elimina variancia)
        disableSkillMatching?: boolean; // Desabilita matching semantico
      };
}
```

Quando `deterministic: true` (atalho):

- `temperature: 0`, `seed: 42`, `topP: 1`
- Memory extraction desabilitada
- Skill matching apenas por prefix (sem semantico)
- Resultado: mesma entrada → mesma saida (dentro do possivel com LLMs)

Util para:

- Testes automatizados
- Pipelines de CI/CD
- Uso interno onde consistencia > criatividade

### 11. AgentConfig Atualizado (completo)

```typescript
const AgentConfigSchema = z.object({
  // Obrigatorio
  apiKey: z.string().min(1),
  model: z.string().default("anthropic/claude-sonnet-4"),

  // Identidade
  systemPrompt: z.string().optional(),
  name: z.string().optional(),

  // Tools
  tools: z.array(AgentToolSchema).optional(),

  // Memory
  memory: z
    .union([
      z.boolean(),
      z.object({
        store: z.custom<MemoryStore>(),
        autoExtract: z.boolean().default(true),
        extractionRate: z.number().min(0).max(1).default(0.3),
        extractionModel: z.string().optional(),
        maxMemories: z.number().default(1000),
        decayInterval: z.number().default(50),
        decayFactor: z.number().min(0).max(1).default(0.95),
        minConfidence: z.number().min(0).max(1).default(0.1),
      }),
    ])
    .optional(),

  // Knowledge
  knowledge: z
    .union([
      z.boolean(),
      z.object({
        store: z.custom<VectorStore>(),
        embeddingModel: z.string().optional(),
        chunkingStrategy: z.custom<ChunkingStrategy>().optional(),
        cacheResults: z.boolean().default(true),
      }),
    ])
    .optional(),

  // Skills
  skills: z.array(AgentSkillSchema).optional(),

  // MCP
  mcp: z.array(MCPConnectionConfigSchema).optional(),

  // Conversation
  conversation: z
    .object({
      store: z.custom<ConversationStore>().optional(),
      maxPinnedMessages: z.number().default(20),
    })
    .optional(),

  // Cost control
  costPolicy: z
    .object({
      maxTokensPerExecution: z.number().positive().optional(),
      maxTokensPerSession: z.number().positive().optional(),
      maxToolCallsPerExecution: z.number().positive().optional(),
      onLimitReached: z.enum(["stop", "warn"]).default("stop"),
    })
    .optional(),

  // Tuning
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().positive().optional(),
  maxToolIterations: z.number().min(1).max(50).default(10),
  timeout: z.number().positive().default(120_000),
  toolExecution: z.enum(["parallel", "sequential"]).default("parallel"),
  onToolError: z.enum(["continue", "stop", "retry"]).default("continue"),
  maxConsecutiveErrors: z.number().min(1).default(3),

  // Determinism
  deterministic: z
    .union([
      z.boolean(),
      z.object({
        seed: z.number().optional(),
        temperature: z.literal(0).optional(),
        topP: z.literal(1).optional(),
        disableMemoryExtraction: z.boolean().optional(),
        disableSkillMatching: z.boolean().optional(),
      }),
    ])
    .optional(),

  // OpenRouter
  openrouter: z
    .object({
      baseUrl: z.string().url().default("https://openrouter.ai/api/v1"),
      referer: z.string().optional(),
      title: z.string().optional(),
    })
    .optional(),

  // Reasoning
  reasoning: z
    .object({
      enabled: z.boolean().default(false),
      effort: z.enum(["low", "medium", "high", "xhigh"]).optional(),
      maxTokens: z.number().optional(),
      exclude: z.boolean().optional(),
    })
    .optional(),

  // Hooks
  hooks: z.custom<AgentHooks>().optional(),

  // Context pipeline
  contextPipeline: z
    .object({
      maxInjectionTokens: z.number().optional(),
      compactionModel: z.string().optional(),
      historyRatio: z.number().min(0.1).max(0.9).default(0.5),
      injectionRatio: z.number().min(0.1).max(0.9).default(0.3),
      reserveRatio: z.number().min(0.05).max(0.5).default(0.2),
    })
    .optional(),
});
```

## Verificacao

```bash
# TypeScript compilation
npx tsc --noEmit src/agent/**/*.ts

# Teste manual minimo
npx tsx src/agent/example.ts
```

```typescript
// Teste 1: Chat simples
const agent = new Agent({
  apiKey: "sk-...",
  model: "anthropic/claude-sonnet-4",
});
for await (const ev of agent.stream("Olá!")) {
  if (ev.type === "text_delta") process.stdout.write(ev.data);
}

// Teste 2: Tool calling
const agent = new Agent({
  apiKey: "sk-...",
  model: "anthropic/claude-sonnet-4",
  tools: [
    {
      name: "get_weather",
      description: "Get weather",
      parameters: z.object({ city: z.string() }),
      execute: async ({ city }) => `25°C in ${city}`,
    },
  ],
});
for await (const ev of agent.stream("Weather in SP?")) {
  console.log(ev.type, ev);
}

// Teste 3: Multimodal (visao)
for await (const ev of agent.stream([
  { type: "text", text: "Descreva esta imagem" },
  { type: "image_url", image_url: { url: "https://example.com/foto.jpg" } },
])) {
  if (ev.type === "text_delta") process.stdout.write(ev.data);
}

// Teste 4: Structured output
const agent2 = new Agent({ apiKey: "sk-...", model: "openai/gpt-4o" });
const json = await agent2.chat("List 3 colors", {
  responseFormat: { type: "json_object" },
});
console.log(JSON.parse(json));

// Teste 5: Threads isoladas
const agent3 = new Agent({ apiKey: "sk-...", model: "...", memory: true });
await agent3.chat("Meu nome e Douglas", { threadId: "thread-1" });
await agent3.chat("Meu nome e Maria", { threadId: "thread-2" });
await agent3.chat("Qual meu nome?", { threadId: "thread-1" }); // → Douglas
await agent3.chat("Qual meu nome?", { threadId: "thread-2" }); // → Maria

// Teste 6: Model override por request
const agent4 = new Agent({ apiKey: "sk-...", model: "openai/gpt-4o-mini" });
await agent4.chat("Pergunta simples"); // usa gpt-4o-mini
await agent4.chat("Pergunta complexa", { model: "anthropic/claude-sonnet-4" }); // usa claude

// Teste 7: Knowledge RAG
const agent5 = new Agent({ apiKey: "sk-...", model: "...", knowledge: true });
await agent5.ingestKnowledge({
  content: "O produto X custa R$99 e tem garantia de 2 anos...",
});
await agent5.chat("Quanto custa o produto X?"); // → R$99

// Teste 8: MCP
const agent6 = new Agent({
  apiKey: "sk-...",
  model: "...",
  mcp: [
    {
      name: "whatsapp",
      transport: "stdio",
      command: "node",
      args: ["mcp-server.js"],
    },
  ],
});
await agent6.chat("Envia mensagem no WhatsApp para +55...");

// Teste 9: Cost tracking
const agent7 = new Agent({ apiKey: "sk-...", model: "..." });
await agent7.chat("Hello");
console.log(agent7.getUsage()); // { inputTokens: 150, outputTokens: 50, totalTokens: 200 }
```

## Coexistencia

Codigo vive em `src/agent/` e **nao importa nada** de `src/chat/`, `src/tools/`, `src/lib/`, etc. Modulo 100% isolado.

## Gaps Resolvidos

### Fase 1 — Gaps estruturais (v1)

| Gap                      | Solucao Implementada                                                                                     |
| ------------------------ | -------------------------------------------------------------------------------------------------------- |
| Thread isolation         | `ConversationManager` com `Map<threadId, ChatMessage[]>` + interface `ConversationStore` plugavel        |
| Multimodal               | `ContentPart` (text + image_url) em input/output, `ChatMessage.content` aceita `string \| ContentPart[]` |
| Structured output        | `responseFormat` em `ChatOptions` (text, json_object, json_schema)                                       |
| Knowledge chunking       | `ChunkingStrategy` interface + `FixedSizeChunking` + `RecursiveCharacterChunking`                        |
| Tool return type         | `AgentToolResult` com `content + metadata`, execute aceita `string \| AgentToolResult`                   |
| Model/prompt override    | `model?`, `systemPrompt?`, `temperature?` em `ChatOptions`                                               |
| History compaction       | `ContextBuilder` sumariza historico antigo via LLM, preserva ultimas 10 msgs                             |
| MCP dynamic import       | `import()` lazy com erro amigavel se SDK nao instalado                                                   |
| ReactLoop error recovery | `onToolError: 'continue' \| 'stop' \| 'retry'` + `maxConsecutiveErrors`                                  |
| Memory sampling          | `extractionRate: 0.3` (30% dos turnos) + `extractionModel` dedicado                                      |
| Token counter i18n       | Heuristica por charset (latin ~4 chars/token, CJK ~1.5)                                                  |
| Streaming backpressure   | Bounded queue no `StreamEmitter` com tamanho maximo configuravel                                         |
| Cost tracking            | `getUsage()` com acumulador de tokens por sessao                                                         |
| Warning events           | Novo evento `warning` para truncamento, rate limit, etc.                                                 |
| Tool cancellation        | `AgentTool.execute` recebe `signal?: AbortSignal`                                                        |
| Skills semantico         | `SkillManager` usa `EmbeddingService` quando disponivel para matching por similaridade                   |

### Fase 2 — Endurecimento para producao (v2)

| Gap                          | Solucao Implementada                                                                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| Pipeline de contexto         | `ContextPipeline` com etapas explicitas (skills → knowledge → memory → history), corte por prioridade |
| Controle ativo de custo      | `CostPolicy` com limites por execucao/sessao/tool calls, acao `stop` ou `warn`                        |
| Mensagens criticas           | `pinned: true` em `ChatOptions`, preservadas durante compactacao (max 20 pinadas)                     |
| Qualidade de memoria         | Extracao event-driven (triggers inteligentes) + decay temporal + limpeza automatica                   |
| Validacao semantica de tools | `tool.validate()` opcional verifica intencao antes da execucao                                        |
| MCP robustez                 | Reconexao automatica, timeout por operacao, healthcheck, isolamento de falhas por tool                |
| Conflito de skills           | Prioridade numerica + `exclusive` flag + desempate por especificidade + max 3 ativas                  |
| Concorrencia                 | Mutex por thread no `ConversationManager`, execucoes serializadas por thread                          |
| Caching                      | `LRUCache<K,V>` com TTL para embeddings (~60-80% reducao), knowledge results, skill descriptions      |
| Observabilidade              | `ExecutionContext` com `traceId` em todos os eventos, correlacao end-to-end, timing por etapa         |
| Determinismo                 | `deterministic: true` forca seed/temperature/topP fixos, desabilita variancia de memoria e skills     |

### Fase 3 — Endurecimento para escala (v3)

| Gap                              | Solucao Implementada                                                                            |
| -------------------------------- | ----------------------------------------------------------------------------------------------- |
| Isolamento entre execucoes       | `ExecutionScope` com estado isolado por chamada (custo, cache, tools carregadas)                |
| Limites globais de recursos      | `ResourceLimits` com max threads, max history/thread, max total memory entries                  |
| Snapshot de contexto             | `ContextSnapshot` captura exatamente o que foi enviado ao LLM (audit/debug/replay)              |
| Resiliencia no loop              | `RecoveryStrategy` para respostas invalidas, structured output malformado, tool calls fantasmas |
| Validacao pos-resposta           | `OutputValidator` valida structured output com Zod apos resposta do LLM, com retry              |
| Fallback de modelo               | `ModelFallbackChain` tenta modelos alternativos quando o principal falha                        |
| Rate limiting interno            | `RateLimiter` com token bucket por modelo, previne abuso e protege budget                       |
| Sandbox de tools                 | `ToolSandbox` com timeout, memory limit e isolamento de side-effects                            |
| Precedencia memoria vs knowledge | Politica explicita de conflito: knowledge factual > memoria extraida > memoria antiga           |
| Modo debug estruturado           | `DebugMode` expoe pipeline decisions, context assembly, tool selection reasons                  |

---

## Detalhamento — Fase 3: Endurecimento para Escala

### 1. Isolamento entre Execucoes (ExecutionScope)

O `Agent` pode receber chamadas concorrentes. Cada `chat()` ou `stream()` cria um `ExecutionScope` isolado que carrega seu proprio estado mutavel:

```typescript
class ExecutionScope {
  readonly traceId: string;
  readonly threadId: string;
  readonly startedAt: number;

  // Estado isolado por execucao — NAO compartilhado
  usage: TokenUsage; // Contagem de tokens DESTA execucao
  toolCallCount: number; // Tool calls DESTA execucao
  iterationCount: number; // Iteracoes do ReactLoop DESTA execucao

  // Referencia ao estado compartilhado (read-only durante execucao)
  readonly sharedCost: TokenUsage; // Referencia ao acumulador global (leitura)

  // Ao final da execucao, merge atomico para o estado global
  commit(): void;
}
```

**Fluxo**:

1. `agent.stream()` cria um `ExecutionScope`
2. Todo o ReactLoop, ContextPipeline e MemoryManager operam sobre o scope
3. Cost checks usam `scope.usage + scope.sharedCost` (local + global)
4. Ao final, `scope.commit()` faz merge atomico do usage para o acumulador global
5. Se a execucao for abortada, o scope e descartado sem afetar o global

Isso resolve: contagem incorreta de custo em execucoes concorrentes, estado compartilhado corrompido, tool call count misturado entre execucoes.

### 2. Limites Globais de Recursos (ResourceLimits)

```typescript
interface ResourceLimits {
  maxThreads?: number; // Max conversas simultaneas (default: 100)
  maxHistoryPerThread?: number; // Max mensagens por thread (default: 500)
  maxTotalMemories?: number; // Max memorias em todos os scopes (default: 10_000)
  maxVectorStoreEntries?: number; // Max documentos no SQLiteVectorStore (default: 50_000)
  maxCacheMemoryMB?: number; // Limite de RAM para caches (default: 256)
  onLimitReached: "reject" | "evict"; // 'reject' = erro, 'evict' = remove mais antigos
}
```

**Politica de eviction** (quando `onLimitReached: 'evict'`):

- Threads: remove a thread com ultimo acesso mais antigo
- History: compacta (sumariza) as mensagens mais antigas da thread
- Memories: remove por menor confidence (decay natural)
- VectorStore: remove documentos com menor access count
- Caches: LRU ja faz eviction natural

```typescript
const agent = new Agent({
  apiKey: "...",
  model: "...",
  resourceLimits: {
    maxThreads: 50,
    maxHistoryPerThread: 200,
    maxTotalMemories: 5_000,
    onLimitReached: "evict",
  },
});
```

### 3. Context Snapshot (auditoria e replay)

Cada execucao gera um snapshot imutavel do contexto final enviado ao LLM:

```typescript
interface ContextSnapshot {
  traceId: string;
  timestamp: number;
  model: string;

  // Exatamente o que foi enviado ao LLM
  systemPrompt: string;
  messages: ChatMessage[];
  tools: OpenRouterToolDef[];

  // Como o contexto foi montado
  pipeline: {
    stage: string;
    tokensInjected: number;
    contentPreview: string; // Primeiros 200 chars de cada injection
    skipped: boolean; // Se foi cortado por budget
    skipReason?: string;
  }[];

  // Budget
  totalBudget: number;
  tokensUsed: number;
  budgetUtilization: number; // 0-1

  // Skills, memories e knowledge usados
  activeSkills: string[];
  memoriesRecalled: number;
  knowledgeSourcesUsed: number;
}
```

**Acesso**:

```typescript
// Via evento
agent.stream("Hello", {
  hooks: {
    onEvent: (event) => {
      if (event.type === "context_snapshot") {
        console.log("Context sent to LLM:", event.snapshot);
        // Salvar para auditoria, replay, debug
      }
    },
  },
});

// Via API direta
const lastSnapshot = agent.getLastSnapshot(threadId);
```

Novo evento adicionado ao `AgentEvent`:

```typescript
| { type: 'context_snapshot'; traceId: string; snapshot: ContextSnapshot }
```

### 4. Resiliencia Inteligente no Loop (RecoveryStrategy)

Alem de `onToolError`, o ReactLoop agora trata falhas do proprio LLM:

```typescript
interface RecoveryStrategy {
  // Resposta vazia ou sem sentido do LLM
  onEmptyResponse: "retry" | "fallback" | "error"; // default: 'retry'
  maxEmptyRetries: number; // default: 2

  // Tool call para tool que nao existe (alucinacao)
  onPhantomToolCall: "ignore" | "error_to_llm" | "error"; // default: 'error_to_llm'

  // Tool call com argumentos que falham Zod validation
  onInvalidToolArgs: "error_to_llm" | "error"; // default: 'error_to_llm'

  // Structured output invalido (nao passa validacao pos-resposta)
  onInvalidOutput: "retry" | "retry_with_feedback" | "error"; // default: 'retry_with_feedback'
  maxOutputRetries: number; // default: 2

  // Timeout do LLM (resposta nao chega)
  onTimeout: "retry" | "fallback" | "error"; // default: 'retry'
  maxTimeoutRetries: number; // default: 1
}
```

**Fluxo `retry_with_feedback`** (para structured output):

1. LLM retorna JSON invalido
2. Valida com Zod → captura erros de validacao
3. Envia ao LLM: "Your previous response was invalid: {zodErrors}. Please try again following the schema exactly."
4. LLM tenta novamente com o feedback
5. Se falhar de novo apos `maxOutputRetries` → yield error

**Fluxo `error_to_llm`** (para tool calls invalidas):

- Envia resultado de erro ao LLM como tool_result: "Tool 'xyz' does not exist. Available tools: [list]"
- O LLM se auto-corrige na proxima iteracao

### 5. Validacao Pos-Resposta (OutputValidator)

Quando `responseFormat` e definido, a resposta do LLM e validada automaticamente:

```typescript
class OutputValidator {
  // Valida structured output contra o schema definido em ChatOptions
  validate(response: string, format: ResponseFormat): ValidationResult;

  // Se invalido, gera mensagem de feedback para retry
  generateFeedback(errors: z.ZodError): string;
}

interface ValidationResult {
  valid: boolean;
  parsed?: unknown; // Dados parseados se valido
  errors?: z.ZodError; // Erros de validacao se invalido
  raw: string; // Resposta original do LLM
}
```

Integrado com `RecoveryStrategy.onInvalidOutput`:

```typescript
const agent = new Agent({
  apiKey: "...",
  model: "...",
  recovery: { onInvalidOutput: "retry_with_feedback", maxOutputRetries: 2 },
});

// Resposta garantida como JSON valido ou erro explicito
const result = await agent.chat("List 3 users", {
  responseFormat: {
    type: "json_schema",
    name: "users",
    schema: z.object({
      users: z.array(z.object({ name: z.string(), age: z.number() })),
    }),
  },
});
```

### 6. Fallback de Modelo (ModelFallbackChain)

```typescript
interface ModelFallbackConfig {
  primary: string; // Modelo principal
  fallbacks: string[]; // Modelos alternativos em ordem de preferencia
  triggerOn: ("error" | "timeout" | "rate_limit" | "overloaded")[]; // Quando acionar fallback
  maxFallbackAttempts?: number; // default: fallbacks.length
}
```

```typescript
const agent = new Agent({
  apiKey: "...",
  model: "anthropic/claude-sonnet-4",
  fallbackModels: {
    fallbacks: ["openai/gpt-4o", "google/gemini-2.5-flash"],
    triggerOn: ["error", "timeout", "rate_limit", "overloaded"],
  },
});
// Se claude falhar → tenta gpt-4o → tenta gemini
// yield warning event informando qual modelo foi usado como fallback
```

**Deteccao de trigger**:

- `error`: HTTP 5xx ou erro de parse na resposta
- `timeout`: Sem resposta apos `timeout` ms
- `rate_limit`: HTTP 429
- `overloaded`: HTTP 503 ou erro especifico de provider

### 7. Rate Limiting Interno (RateLimiter)

```typescript
class RateLimiter {
  constructor(config: {
    requestsPerMinute?: number; // Max chamadas ao LLM por minuto (default: 60)
    tokensPerMinute?: number; // Max tokens por minuto (default: 200_000)
    concurrentRequests?: number; // Max chamadas simultaneas (default: 5)
  });

  // Retorna tempo de espera (0 = pode prosseguir)
  async acquire(estimatedTokens?: number): Promise<void>;

  // Libera slot de concorrencia
  release(): void;
}
```

Integrado no `OpenRouterClient`:

- Antes de cada chamada, `rateLimiter.acquire()` — se o limite foi atingido, espera
- Se `costPolicy.onLimitReached === 'stop'`, lanca erro em vez de esperar
- yield `warning` event quando rate limit e atingido

### 8. Sandbox de Tools (ToolSandbox)

```typescript
interface ToolSandboxConfig {
  timeoutPerTool?: number; // Timeout por execucao de tool (default: 30_000ms)
  maxResultSize?: number; // Max chars do resultado (default: 50_000)
  allowedSideEffects?: ("network" | "filesystem" | "process")[]; // Whitelist
  isolateErrors?: boolean; // Se true, erro de tool nao propaga (default: true)
}
```

O `ToolExecutor` aplica sandbox em cada execucao:

1. **Timeout**: `AbortController` com timeout configuravel — se tool travar, retorna erro
2. **Result size**: Trunca resultado se exceder `maxResultSize` (yield warning)
3. **Error isolation**: Try/catch por tool — erro nao crasheia o agente, retorna como tool_result de erro
4. **Side effects**: Metadata declarativa na tool — o sandbox pode validar se a tool tem permissao

```typescript
const dangerousTool: AgentTool = {
  name: "execute_query",
  description: "Run SQL query",
  parameters: z.object({ sql: z.string() }),
  sideEffects: ["network"], // Declara que faz chamada de rede
  execute: async ({ sql }) => {
    /* ... */
  },
};

const agent = new Agent({
  apiKey: "...",
  model: "...",
  tools: [dangerousTool],
  toolSandbox: {
    timeoutPerTool: 10_000,
    maxResultSize: 10_000,
    allowedSideEffects: ["network"], // Permite network, bloqueia filesystem/process
  },
});
```

### 9. Precedencia Memoria vs Knowledge (ConflictPolicy)

Quando memoria e knowledge retornam informacoes conflitantes, existe uma politica explicita:

```typescript
interface ConflictPolicy {
  // Ordem de precedencia (primeiro = maior prioridade)
  precedence: (
    | "knowledge"
    | "memory_user"
    | "memory_extracted"
    | "memory_old"
  )[];
  // default: ['knowledge', 'memory_user', 'memory_extracted', 'memory_old']

  // Marcacao no contexto injetado
  annotateSource: boolean; // default: true
  // Se true, cada injection recebe prefixo: "[source: knowledge]", "[source: memory]"
  // Ajuda o LLM a priorizar informacao correta
}
```

**Implementado no `ContextPipeline`**:

1. Knowledge factual (documentos ingeridos) tem prioridade maxima
2. Memoria explicita do usuario ("Meu nome e...") vem em seguida
3. Memoria extraida automaticamente vem depois
4. Memorias antigas (baixo confidence) tem menor prioridade

Quando budget aperta e precisa cortar:

- Corta na ordem inversa da precedencia (memorias antigas primeiro, knowledge por ultimo)

Quando conteudo conflita:

- Se `annotateSource: true`, o LLM recebe marcacao de fonte para decidir
- Exemplo: `"[source: knowledge, confidence: 1.0] Product X costs $99"` vs `"[source: memory, confidence: 0.6] User mentioned product X costs $89"`

### 10. Modo Debug Estruturado (DebugMode)

```typescript
interface DebugConfig {
  enabled: boolean; // default: false
  verbosity: "minimal" | "standard" | "verbose"; // default: 'standard'
  includeContextSnapshot: boolean; // Inclui snapshot completo (default: true em verbose)
  includeTokenCounts: boolean; // Tokens por etapa do pipeline (default: true)
  includePipelineDecisions: boolean; // Motivos de corte/inclusao (default: true)
  includeToolSelectionReason: boolean; // Por que o LLM escolheu esta tool (default: false)
  output: "events" | "console" | "callback"; // Onde emitir debug info
  callback?: (info: DebugInfo) => void;
}
```

Novos eventos de debug:

```typescript
type AgentEvent =
  // ... eventos existentes ...
  | { type: "debug_pipeline"; traceId: string; stages: PipelineStageDebug[] }
  | { type: "debug_context"; traceId: string; snapshot: ContextSnapshot }
  | { type: "debug_tool_selection"; traceId: string; reasoning: string }
  | {
      type: "debug_memory_decision";
      traceId: string;
      extracted: Memory[];
      skipped: string[];
    };

interface PipelineStageDebug {
  stage: string;
  duration: number;
  tokensIn: number;
  tokensOut: number;
  decision: string; // "included", "skipped_budget", "skipped_empty"
  details: Record<string, unknown>;
}
```

```typescript
// Uso: debug completo
const agent = new Agent({
  apiKey: "...",
  model: "...",
  debug: {
    enabled: true,
    verbosity: "verbose",
    output: "events",
  },
});

for await (const ev of agent.stream("Hello")) {
  if (ev.type === "debug_pipeline") {
    console.table(ev.stages); // Tabela com cada etapa, duracao, tokens, decisao
  }
  if (ev.type === "debug_context") {
    // Exatamente o que foi enviado ao LLM
    console.log("System prompt:", ev.snapshot.systemPrompt.slice(0, 500));
    console.log("Messages:", ev.snapshot.messages.length);
    console.log("Budget used:", ev.snapshot.budgetUtilization);
  }
}
```

---

## AgentConfig Final (v3 completo)

```typescript
const AgentConfigSchema = z.object({
  // === Obrigatorio ===
  apiKey: z.string().min(1),
  model: z.string().default("anthropic/claude-sonnet-4"),

  // === Identidade ===
  systemPrompt: z.string().optional(),
  name: z.string().optional(),

  // === Storage (SQLite) ===
  storage: z
    .object({
      path: z.string().default("~/.agent/data.db"), // Caminho do arquivo SQLite
      walMode: z.boolean().default(true), // WAL mode para concorrencia
      inMemory: z.boolean().default(false), // ':memory:' para testes
    })
    .optional(),

  // === Tools ===
  tools: z.array(AgentToolSchema).optional(),
  toolExecution: z.enum(["parallel", "sequential"]).default("parallel"),
  onToolError: z.enum(["continue", "stop", "retry"]).default("continue"),
  maxConsecutiveErrors: z.number().min(1).default(3),
  toolSandbox: z
    .object({
      timeoutPerTool: z.number().default(30_000),
      maxResultSize: z.number().default(50_000),
      allowedSideEffects: z
        .array(z.enum(["network", "filesystem", "process"]))
        .optional(),
      isolateErrors: z.boolean().default(true),
    })
    .optional(),

  // === Memory ===
  memory: z
    .union([
      z.boolean(),
      z.object({
        store: z.custom<MemoryStore>(),
        autoExtract: z.boolean().default(true),
        extractionRate: z.number().min(0).max(1).default(0.3),
        extractionModel: z.string().optional(),
        maxMemories: z.number().default(1000),
        decayInterval: z.number().default(50),
        decayFactor: z.number().min(0).max(1).default(0.95),
        minConfidence: z.number().min(0).max(1).default(0.1),
      }),
    ])
    .optional(),

  // === Knowledge ===
  knowledge: z
    .union([
      z.boolean(),
      z.object({
        store: z.custom<VectorStore>(),
        embeddingModel: z.string().optional(),
        chunkingStrategy: z.custom<ChunkingStrategy>().optional(),
        cacheResults: z.boolean().default(true),
      }),
    ])
    .optional(),

  // === Skills ===
  skills: z.array(AgentSkillSchema).optional(),

  // === MCP ===
  mcp: z.array(MCPConnectionConfigSchema).optional(),

  // === Conversation ===
  conversation: z
    .object({
      store: z.custom<ConversationStore>().optional(),
      maxPinnedMessages: z.number().default(20),
    })
    .optional(),

  // === Cost Control ===
  costPolicy: z
    .object({
      maxTokensPerExecution: z.number().positive().optional(),
      maxTokensPerSession: z.number().positive().optional(),
      maxToolCallsPerExecution: z.number().positive().optional(),
      onLimitReached: z.enum(["stop", "warn"]).default("stop"),
    })
    .optional(),

  // === Resilience ===
  recovery: z
    .object({
      onEmptyResponse: z.enum(["retry", "fallback", "error"]).default("retry"),
      maxEmptyRetries: z.number().default(2),
      onPhantomToolCall: z
        .enum(["ignore", "error_to_llm", "error"])
        .default("error_to_llm"),
      onInvalidToolArgs: z
        .enum(["error_to_llm", "error"])
        .default("error_to_llm"),
      onInvalidOutput: z
        .enum(["retry", "retry_with_feedback", "error"])
        .default("retry_with_feedback"),
      maxOutputRetries: z.number().default(2),
      onTimeout: z.enum(["retry", "fallback", "error"]).default("retry"),
      maxTimeoutRetries: z.number().default(1),
    })
    .optional(),

  // === Model Fallback ===
  fallbackModels: z
    .object({
      fallbacks: z.array(z.string()),
      triggerOn: z.array(
        z.enum(["error", "timeout", "rate_limit", "overloaded"]),
      ),
      maxFallbackAttempts: z.number().optional(),
    })
    .optional(),

  // === Rate Limiting ===
  rateLimiting: z
    .object({
      requestsPerMinute: z.number().default(60),
      tokensPerMinute: z.number().default(200_000),
      concurrentRequests: z.number().default(5),
    })
    .optional(),

  // === Resource Limits ===
  resourceLimits: z
    .object({
      maxThreads: z.number().default(100),
      maxHistoryPerThread: z.number().default(500),
      maxTotalMemories: z.number().default(10_000),
      maxVectorStoreEntries: z.number().default(50_000),
      maxCacheMemoryMB: z.number().default(256),
      onLimitReached: z.enum(["reject", "evict"]).default("evict"),
    })
    .optional(),

  // === Conflict Resolution ===
  conflictPolicy: z
    .object({
      precedence: z
        .array(
          z.enum([
            "knowledge",
            "memory_user",
            "memory_extracted",
            "memory_old",
          ]),
        )
        .default([
          "knowledge",
          "memory_user",
          "memory_extracted",
          "memory_old",
        ]),
      annotateSource: z.boolean().default(true),
    })
    .optional(),

  // === Tuning ===
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().positive().optional(),
  maxToolIterations: z.number().min(1).max(50).default(10),
  timeout: z.number().positive().default(120_000),

  // === Determinism ===
  deterministic: z
    .union([
      z.boolean(),
      z.object({
        seed: z.number().optional(),
        temperature: z.literal(0).optional(),
        topP: z.literal(1).optional(),
        disableMemoryExtraction: z.boolean().optional(),
        disableSkillMatching: z.boolean().optional(),
      }),
    ])
    .optional(),

  // === OpenRouter ===
  openrouter: z
    .object({
      baseUrl: z.string().url().default("https://openrouter.ai/api/v1"),
      referer: z.string().optional(),
      title: z.string().optional(),
    })
    .optional(),

  // === Reasoning ===
  reasoning: z
    .object({
      enabled: z.boolean().default(false),
      effort: z.enum(["low", "medium", "high", "xhigh"]).optional(),
      maxTokens: z.number().optional(),
      exclude: z.boolean().optional(),
    })
    .optional(),

  // === Hooks ===
  hooks: z.custom<AgentHooks>().optional(),

  // === Context Pipeline ===
  contextPipeline: z
    .object({
      maxInjectionTokens: z.number().optional(),
      compactionModel: z.string().optional(),
      historyRatio: z.number().min(0.1).max(0.9).default(0.5),
      injectionRatio: z.number().min(0.1).max(0.9).default(0.3),
      reserveRatio: z.number().min(0.05).max(0.5).default(0.2),
    })
    .optional(),

  // === Debug ===
  debug: z
    .object({
      enabled: z.boolean().default(false),
      verbosity: z.enum(["minimal", "standard", "verbose"]).default("standard"),
      includeContextSnapshot: z.boolean().default(false),
      includeTokenCounts: z.boolean().default(true),
      includePipelineDecisions: z.boolean().default(true),
      includeToolSelectionReason: z.boolean().default(false),
      output: z.enum(["events", "console", "callback"]).default("events"),
      callback: z.function().optional(),
    })
    .optional(),
});
```
