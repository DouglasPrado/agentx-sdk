# Casos de Uso

> Quais são as ações que os usuários podem realizar no sistema?

---

## UC-001: Chat Simples (texto)

**Ator:** Aplicação Host (desenvolvedor)

**Pré-condição:** Agent instanciado com apiKey e model válidos.

#### Fluxo Principal

1. Host chama `agent.chat(input)` com string de texto
2. Agent constrói contexto via ContextPipeline
3. Agent executa ReactLoop com streaming interno
4. OpenRouterClient envia request ao OpenRouter e recebe resposta
5. Agent retorna texto completo como string

#### Fluxos Alternativos

- **1a.** Input é `ContentPart[]` (multimodal com imagem): Agent serializa content parts no formato OpenAI e envia ao LLM
- **1b.** Options inclui `model` override: Agent usa modelo especificado ao invés do default
- **1c.** Options inclui `threadId`: Agent usa histórico isolado da thread especificada

#### Fluxo de Exceção

- **E1.** OpenRouter API indisponível: Retry com backoff exponencial. Após esgotamento, lança erro
- **E2.** CostPolicy.maxTokensPerSession excedido: Lança erro ou emite warning conforme config

**Pós-condição:** Resposta do LLM retornada. Mensagens do usuário e assistente persistidas no histórico da thread.

**Requisitos:** RF-001, RF-002, RF-005, RF-022, RF-026

---

## UC-002: Stream Chat com Eventos

**Ator:** Aplicação Host

**Pré-condição:** Agent instanciado com apiKey e model válidos.

#### Fluxo Principal

1. Host chama `agent.stream(input, options?)`
2. Agent cria ExecutionContext e StreamEmitter
3. Agent constrói contexto via ContextPipeline
4. ReactLoop inicia e emite `agent_start`, `turn_start`
5. Para cada chunk do LLM, emite `text_delta`
6. Ao final, emite `text_done`, `turn_end`, `agent_end` com usage
7. Host consome eventos via `for await (const ev of iterator)`

#### Fluxos Alternativos

- **4a.** LLM retorna tool_calls: ReactLoop emite `tool_call_start`, executa tools, emite `tool_call_end`, reinicia iteração
- **5a.** LLM suporta reasoning: emite `thinking` events antes de `text_delta`

#### Fluxo de Exceção

- **E1.** Host chama `signal.abort()` (AbortSignal): ReactLoop para imediatamente, emite `agent_end`
- **E2.** maxIterations atingido: Emite `warning` e para com último texto disponível
- **E3.** maxConsecutiveErrors atingido: Emite `error` event e para o loop

**Pós-condição:** Todos os eventos entregues ao consumidor. Histórico persistido.

**Requisitos:** RF-001, RF-003, RF-007, RF-025

---

## UC-003: Registrar e Executar Tool

**Ator:** Aplicação Host

**Pré-condição:** Agent instanciado.

#### Fluxo Principal

1. Host chama `agent.addTool({ name, description, parameters: z.object(...), execute })`
2. ToolExecutor registra a tool com schema Zod
3. Em uma chamada `stream()`/`chat()`, LLM decide usar a tool
4. ToolExecutor valida args via Zod → converte para JSON Schema
5. ToolExecutor executa `beforeToolCall` hook (se definido)
6. ToolExecutor chama `tool.execute(args, signal)`
7. ToolExecutor executa `afterToolCall` hook (se definido)
8. Resultado retornado ao LLM como tool_result

#### Fluxos Alternativos

- **4a.** Tool tem `validate()` definido: Após Zod, executa validação semântica com contexto de conversa
- **6a.** Tool retorna `AgentToolResult` (rico): metadata incluído no evento mas apenas content vai ao LLM
- **6b.** Execução parallel: Múltiplas tools executam simultaneamente via `Promise.all()`

#### Fluxo de Exceção

- **E1.** Nome da tool já registrado: Sobrescreve a tool anterior (ou lança erro conforme implementação)
- **E2.** Validação Zod falha: Retorna erro imediato ao LLM sem executar
- **E3.** Tool lança exceção: Segue `onToolError` (continue → erro como tool_result; stop → para loop; retry → 1 tentativa)
- **E4.** Validação semântica falha: Envia `reason` e `suggestion` ao LLM como tool_result de erro

**Pós-condição:** Tool registrada e disponível para o LLM. Resultado de execução incluído no histórico.

**Requisitos:** RF-004, RF-010, RF-021, RF-028

---

## UC-004: Conectar Servidor MCP

**Ator:** Aplicação Host

**Pré-condição:** Agent instanciado. `@modelcontextprotocol/sdk` instalado no projeto.

#### Fluxo Principal (via constructor)

1. Host instancia Agent com `mcp: [{ name, transport: 'stdio', command: '...', args: [...], timeout, maxRetries, healthCheckInterval, isolateErrors }]`
2. Agent chama MCPAdapter.connect() para cada server configurado durante inicialização
3. MCPAdapter faz dynamic import do SDK
4. MCPAdapter estabelece conexão com o server (stdio ou SSE)
5. MCPAdapter lista tools do server via MCP protocol
6. MCPAdapter converte tools MCP para AgentTool e registra no ToolExecutor
7. Tools MCP ficam disponíveis para o LLM nas próximas execuções

#### Fluxos Alternativos

- **1a.** Conexão dinâmica: Host chama `agent.connectMCP({ ... })` em runtime para adicionar servers
- **1b.** Transport é SSE: MCPAdapter conecta via HTTP ao URL fornecido
- **7a.** healthCheckInterval configurado: MCPAdapter inicia heartbeat periódico
- **Desconexão:** Host chama `agent.disconnectMCP()` para desconectar todos os servers
- **Health check:** Host chama `agent.getHealth()` para verificar status dos servers

#### Fluxo de Exceção

- **E1.** SDK não instalado: Lança erro amigável: "Install @modelcontextprotocol/sdk to use MCP connections"
- **E2.** Server não responde: Retry com backoff até maxRetries. Após esgotamento, lança erro
- **E3.** Server desconecta durante sessão: Reconexão automática. Tools removidas até reconexão

**Pós-condição:** Tools MCP registradas e disponíveis. Health check ativo (se configurado).

**Requisitos:** RF-019

---

## UC-005: Ingerir Documento para Knowledge/RAG

**Ator:** Aplicação Host

**Pré-condição:** Agent instanciado com `knowledge: true` (ou config de knowledge).

#### Fluxo Principal

1. Host chama `agent.ingestKnowledge({ content: '...', metadata?: {...} })`
2. KnowledgeManager aplica ChunkingStrategy ao conteúdo
3. KnowledgeManager gera embeddings para cada chunk via EmbeddingService
4. KnowledgeManager persiste chunks com embeddings no VectorStore
5. Documento disponível para busca RAG nas próximas execuções

#### Fluxos Alternativos

- **2a.** ChunkingStrategy customizada fornecida na config: Usa estratégia do consumidor
- **3a.** Embeddings já em cache LRU (conteúdo repetido): Retorna sem chamar API

#### Fluxo de Exceção

- **E1.** EmbeddingService/OpenRouter falha: Ingestão falha — lança erro ao consumidor
- **E2.** SQLite indisponível: Lança erro — persistência é obrigatória

**Pós-condição:** Chunks armazenados com embeddings. Disponíveis para busca semântica.

**Requisitos:** RF-014, RF-015, RF-016, RF-017

---

## UC-006: Memorizar e Recordar Fatos

**Ator:** Aplicação Host / Agent (automático)

**Pré-condição:** Agent instanciado com `memory: true` (ou config de memory).

#### Fluxo Principal (Extração Automática)

1. Após um turno de conversa, MemoryManager avalia se deve extrair memórias
2. Se trigger ativado (explícito, sampling, turnos sem extração): chama LLM de extração
3. LLM retorna fatos estruturados
4. MemoryManager salva cada fato com confidence e embedding

#### Fluxo Principal (Recall Manual)

1. Host chama `agent.recall(query)`
2. MemoryManager busca via SQLiteMemoryStore (FTS5 + embeddings + RRF)
3. Retorna memórias rankeadas por relevância e confidence

#### Fluxo Principal (Remember Explícito)

1. Host chama `agent.remember('fato importante', scope?)`
2. MemoryManager salva com confidence 1.0 e source 'explicit'

#### Fluxos Alternativos

- **1a.** Extração desabilitada (`autoExtract: false` ou `deterministic: true`): Pula extração automática
- **2a.** (Recall) Sem embeddings disponíveis: Busca apenas via FTS5

#### Fluxo de Exceção

- **E1.** LLM de extração falha: Pula extração neste turno — não bloqueia fluxo principal
- **E2.** maxMemories atingido: Aplica decay e remove memórias com menor confidence

**Pós-condição:** Memórias persistidas e disponíveis para recall. Confidence atualizado.

**Requisitos:** RF-012, RF-013

---

## UC-007: Ativar Skill por Input

**Ator:** Aplicação Host (via input do usuário)

**Pré-condição:** Agent instanciado com skills registradas.

#### Fluxo Principal

1. Host registra skills via `agent.addSkill({ name, triggerPrefix?, match?, instructions, tools? })`
2. Usuário envia input que matcha uma skill (ex: "/review código...")
3. SkillManager detecta match (prefix → custom → semântico)
4. ContextPipeline injeta instructions da skill no contexto (prioridade alta)
5. Se skill tem tools exclusivas, são adicionadas ao ToolExecutor para esta execução
6. LLM responde com comportamento modificado pelas instructions da skill

#### Fluxos Alternativos

- **3a.** Múltiplas skills matcham: Desempate por exclusive → priority → especificidade. Máximo 3 ativas
- **3b.** Match semântico (similaridade > 0.7): Requer EmbeddingService disponível

#### Fluxo de Exceção

- **E1.** Skill exclusive ativa bloqueia outras: Apenas a skill exclusive é ativada
- **E2.** EmbeddingService indisponível para matching semântico: Fallback para prefix e custom match apenas

**Pós-condição:** Skill ativada. Instructions injetadas no contexto. LLM responde com comportamento especializado.

**Requisitos:** RF-018

---

## UC-008: Configurar Determinismo para Testes

**Ator:** Aplicação Host (desenvolvedor)

**Pré-condição:** Nenhuma.

#### Fluxo Principal

1. Host instancia Agent com `deterministic: true`
2. Agent configura: temperature 0, seed 42, topP 1
3. Memory extraction é desabilitada (elimina variância)
4. Skill matching usa apenas prefix (sem semântico)
5. Mesma entrada produz mesma saída (dentro do possível com LLMs)

#### Fluxos Alternativos

- **1a.** Config granular: `deterministic: { seed: 123, disableMemoryExtraction: true, disableSkillMatching: false }}`

#### Fluxo de Exceção

- **E1.** Nenhum — determinismo é configuração passiva

**Pós-condição:** Agent opera em modo determinístico. Adequado para testes e CI/CD.

**Requisitos:** RF-027

---

## UC-009: Structured Output (JSON Schema)

**Ator:** Aplicação Host

**Pré-condição:** Agent instanciado. Modelo suporta structured output.

#### Fluxo Principal

1. Host chama `agent.chat(input, { responseFormat: { type: 'json_schema', schema, name } })`
2. Agent passa responseFormat ao OpenRouterClient
3. LLM retorna resposta em JSON conforme schema
4. Agent retorna string JSON ao host

#### Fluxos Alternativos

- **1a.** responseFormat `json_object`: LLM retorna JSON livre (sem schema)
- **1b.** responseFormat `text` (default): LLM retorna texto normal

#### Fluxo de Exceção

- **E1.** Modelo não suporta structured output: OpenRouter retorna erro — propagado ao host
- **E2.** LLM retorna JSON malformado: Retornado como string — host é responsável por parse

**Pós-condição:** Resposta em formato estruturado retornada.

**Requisitos:** RF-023

---

## UC-010: Monitorar Custo da Sessão

**Ator:** Aplicação Host

**Pré-condição:** Agent instanciado com CostPolicy.

#### Fluxo Principal

1. Host configura `costPolicy: { maxTokensPerExecution: 50_000, maxTokensPerSession: 500_000, onLimitReached: 'stop' }`
2. A cada chamada LLM, ReactLoop verifica tokens acumulados vs limite
3. Host pode consultar `agent.getUsage()` a qualquer momento
4. Eventos `agent_end` incluem `TokenUsage` acumulado

#### Fluxos Alternativos

- **2a.** `onLimitReached: 'warn'`: Emite warning event e continua (1x por limite)

#### Fluxo de Exceção

- **E1.** maxTokensPerExecution atingido: Emite `agent_end` com `reason: 'cost_limit'` e para
- **E2.** maxToolCallsPerExecution atingido: Para o ReactLoop

**Pós-condição:** Uso de tokens monitorado e limitado conforme política.

**Requisitos:** RF-020

---

## UC-011: Substituir Store Default (Portabilidade)

**Ator:** Aplicação Host

**Pré-condição:** Agent instanciado. Implementação alternativa de VectorStore, MemoryStore ou ConversationStore disponível.

#### Fluxo Principal

1. Host implementa interface `VectorStore` (3 métodos: `upsert`, `search`, `delete`) com backend alternativo (PgVector, Qdrant, Pinecone)
2. Host instancia Agent com `knowledge: { store: new PgVectorStore({ connectionString: '...' }) }`
3. Agent usa o store fornecido ao invés do SQLiteVectorStore default
4. Todas as operações de knowledge (ingest, search) passam pelo store plugável

#### Fluxos Alternativos

- **2a.** Trocar MemoryStore: `memory: { store: new CustomMemoryStore() }` (5 métodos: save, search, list, delete, update)
- **2b.** Trocar ConversationStore: `conversation: { store: new RedisConversationStore() }` (4 métodos: save, load, delete, list)
- **2c.** `knowledge: true` (sem store explícito): Usa SQLiteVectorStore default

#### Fluxo de Exceção

- **E1.** Store custom lança erro: Propagado ao consumidor — mesmo comportamento que store default
- **E2.** Store não implementa interface completa: Erro de TypeScript em compilação

**Pós-condição:** Agent opera normalmente com backend de persistência alternativo.

**Requisitos:** AP-02 (Interfaces plugáveis)

<!-- APPEND:use-cases -->
