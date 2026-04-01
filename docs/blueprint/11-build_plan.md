# Plano de Construção

> Como o sistema será construído? Defina entregas, prioridades e dependências.

---

## Entregas (Deliverables)

### ENT-001: Fundação (Tipos + Utils)

**Objetivo:** Estabelecer os tipos centrais, utilitários e configuração validada que todos os outros módulos dependem.

**Prioridade:** Must

**Itens:**
- `types.ts` — AgentEvent, Memory, RetrievedKnowledge, TokenUsage, ContentPart, ExecutionContext
- `config.ts` — AgentConfigSchema com validação Zod completa
- `utils/logger.ts` — Logger console-based com levels
- `utils/token-counter.ts` — Estimativa de tokens (i18n-aware: latin ~4, CJK ~1.5)
- `utils/retry.ts` — Retry exponencial com backoff
- `utils/cache.ts` — Cache LRU com TTL e maxSize

**Dependências:**
- Nenhuma (entrega inicial)

**Critérios de Aceite:**
- `tsc --noEmit` compila sem erros
- Todos os tipos centrais exportados e usáveis
- AgentConfig valida corretamente inputs válidos e rejeita inválidos
- Cache LRU respeita maxSize e TTL

**Estimativa:** S

**Requisitos:** RF-005, RF-006, RF-030

---

### ENT-002: LLM Layer (OpenRouter Client)

**Objetivo:** Comunicação HTTP com OpenRouter API: chat completions com streaming SSE, embeddings e structured output.

**Prioridade:** Must

**Itens:**
- `llm/message-types.ts` — ChatMessage (multimodal content), StreamChunk, ToolCallDelta, ResponseFormat
- `llm/reasoning.ts` — buildReasoningArgs por família de modelo
- `llm/openrouter-client.ts` — fetch POST + SSE parsing + embeddings + structured output

**Dependências:**
- ENT-001 concluída (tipos, retry, config)

**Critérios de Aceite:**
- `streamChat()` retorna AsyncIterableIterator de StreamChunks via SSE
- `chat()` retorna resposta completa
- `embed()` retorna vetores de embedding
- Streaming funciona com text e tool_calls
- Structured output (json_object, json_schema) funciona
- Retry com backoff em caso de erro 429/5xx

**Estimativa:** M

**Requisitos:** RF-002, RF-022, RF-023, RF-029

---

### ENT-003: Storage Layer (SQLite)

**Objetivo:** Wrapper centralizado de SQLite com auto-create tables, migrations e WAL mode.

**Prioridade:** Must

**Itens:**
- `storage/sqlite-database.ts` — SQLiteDatabase class com initialize(), close(), migrations

**Dependências:**
- ENT-001 concluída (tipos)

**Critérios de Aceite:**
- `initialize()` cria tabelas memories, memories_fts, vectors, conversations automaticamente
- WAL mode ativo por padrão
- Funciona com path de arquivo e `:memory:` para testes
- Migrações idempotentes (CREATE IF NOT EXISTS)

**Estimativa:** S

**Requisitos:** RF-011

---

### ENT-004: Tools Subsystem

**Objetivo:** Registro de tools, validação Zod → JSON Schema, execução parallel/sequential com hooks.

**Prioridade:** Must

**Itens:**
- `tools/tool-types.ts` — AgentTool, AgentToolResult interfaces
- `tools/tool-executor.ts` — Registro, validação Zod, zod-to-json-schema, execução com hooks
- `tools/mcp-adapter.ts` — MCP SDK → AgentTool (dynamic import, reconnect, fault isolation)

**Dependências:**
- ENT-001 concluída (tipos, config)

**Critérios de Aceite:**
- Tools registradas com schema Zod são convertidas para JSON Schema
- Execução parallel (Promise.all) e sequential funcionam
- beforeToolCall/afterToolCall hooks executam corretamente
- Validação Zod rejeita args inválidos antes de execução
- MCP adapter conecta, lista tools e executa com timeout e reconexão
- MCP configurável via constructor (`mcp: [{ name, transport, command, args, timeout, maxRetries, healthCheckInterval, isolateErrors }]`)
- MCP configurável dinamicamente via `agent.connectMCP()` e `agent.disconnectMCP()`
- `agent.getHealth()` retorna status de todos os MCP servers conectados

**Estimativa:** M

**Requisitos:** RF-004, RF-019, RF-021, RF-028

---

### ENT-005: Memory Subsystem

**Objetivo:** Persistência de memórias com extração automática, decay, busca híbrida e consolidação.

**Prioridade:** Must

**Itens:**
- `memory/memory-store.ts` — Interface MemoryStore
- `memory/sqlite-memory-store.ts` — SQLiteMemoryStore com FTS5 + embeddings + RRF
- `memory/memory-manager.ts` — Extração event-driven + sampling, decay, recall, feedback, consolidação

**Dependências:**
- ENT-002 concluída (OpenRouterClient para embeddings e extração LLM)
- ENT-003 concluída (SQLiteDatabase)

**Critérios de Aceite:**
- Memórias salvas com FTS5 indexado automaticamente
- Busca híbrida (FTS5 + cosseno + RRF) retorna resultados relevantes
- Busca funciona sem embeddings (FTS5 only como fallback)
- Decay reduz confidence de memórias não acessadas
- Memórias abaixo de minConfidence são removidas automaticamente
- Extração automática ativa em 30% dos turnos (sampling) + triggers event-driven

**Estimativa:** L

**Requisitos:** RF-012, RF-013

---

### ENT-006: Knowledge Subsystem (RAG)

**Objetivo:** Ingestão de documentos com chunking, embeddings e busca vetorial.

**Prioridade:** Must

**Itens:**
- `knowledge/chunking.ts` — FixedSizeChunking, RecursiveCharacterChunking
- `knowledge/vector-store.ts` — Interface VectorStore + SQLiteVectorStore (cosseno em JS)
- `knowledge/embedding-service.ts` — embed() via OpenRouter com cache LRU
- `knowledge/knowledge-manager.ts` — ingest (chunking + embed + persist) + search (com cache)

**Dependências:**
- ENT-002 concluída (EmbeddingService usa OpenRouterClient)
- ENT-003 concluída (SQLiteDatabase)

**Critérios de Aceite:**
- Documento ingerido é dividido em chunks e persistido com embeddings
- Busca vetorial retorna top-K chunks por similaridade cosseno
- Cache LRU de embeddings reduz chamadas de API em conversas repetitivas
- Cache de resultados de busca funciona com TTL
- Performance aceitável para 50K vetores (< 100ms)

**Estimativa:** M

**Requisitos:** RF-014, RF-015, RF-016, RF-017

---

### ENT-007: Skills Subsystem

**Objetivo:** Registro de skills com matching em 3 níveis e injeção no contexto.

**Prioridade:** Must

**Itens:**
- `skills/skill-types.ts` — AgentSkill interface (com prioridade, exclusive)
- `skills/skill-manager.ts` — Registro + matching (prefix + custom + semântico) + desempate

**Dependências:**
- ENT-001 concluída (tipos)
- ENT-006 parcialmente (EmbeddingService para matching semântico — opcional)

**Critérios de Aceite:**
- triggerPrefix match funciona (ex: "/review")
- match() customizado funciona
- Matching semântico funciona quando EmbeddingService disponível
- Desempate por exclusive → priority → especificidade
- Máximo 3 skills ativas simultaneamente

**Estimativa:** M

**Requisitos:** RF-018

---

### ENT-008: Core Layer (Loop + Contexto + Stream)

**Objetivo:** ReactLoop com error recovery, StreamEmitter com backpressure, ContextPipeline com budget e ConversationManager com mutex.

**Prioridade:** Must

**Itens:**
- `core/execution-context.ts` — TraceId + correlação + timing
- `core/stream-emitter.ts` — Push/pull async channel com bounded queue e backpressure
- `core/conversation-manager.ts` — Isolamento de threads (Map + mutex + persistência)
- `core/context-pipeline.ts` — Pipeline com 5 stages: SystemPrompt → Skills → Knowledge → Memory → History
- `core/context-builder.ts` — System prompt com budget + compactação + mensagens pinadas
- `core/react-loop.ts` — Loop ReAct com streaming + error recovery + cost guard

**Dependências:**
- ENT-002 concluída (OpenRouterClient)
- ENT-003 concluída (SQLiteDatabase para persistência de conversas)
- ENT-004 concluída (ToolExecutor)
- ENT-005 concluída (MemoryManager — para MemoryStage)
- ENT-006 concluída (KnowledgeManager — para KnowledgeStage)
- ENT-007 concluída (SkillManager — para SkillsStage)

**Critérios de Aceite:**
- ReactLoop itera corretamente: LLM → tool_calls → execute → LLM → texto final
- Error recovery funciona (continue/stop/retry)
- maxIterations e maxConsecutiveErrors param o loop
- CostPolicy para execução quando limite atingido
- StreamEmitter entrega eventos com backpressure
- ConversationManager serializa execuções na mesma thread
- ContextPipeline respeita budget e corta por prioridade
- Mensagens pinadas sobrevivem compactação

**Estimativa:** XL

**Requisitos:** RF-003, RF-007, RF-008, RF-009, RF-010, RF-020, RF-024, RF-025

---

### ENT-009: Agent (Ponto de Entrada) + Exports

**Objetivo:** Classe Agent que orquestra tudo e index.ts com exports públicos.

**Prioridade:** Must

**Itens:**
- `agent.ts` — Classe Agent com chat(), stream(), addTool(), addSkill(), connectMCP(), remember(), recall(), ingestKnowledge(), getUsage(), destroy()
- `index.ts` — Re-exports públicos

**Dependências:**
- ENT-008 concluída (todos os subsistemas e core)

**Critérios de Aceite:**
- Chat simples funciona: `await agent.chat("Olá")`
- Stream funciona: `for await (const ev of agent.stream("Olá"))`
- Tool calling funciona end-to-end
- Memory extraction e recall funcionam
- Knowledge ingestão e RAG funcionam
- Threads isoladas funcionam
- Model override por request funciona
- `tsc --noEmit` sem erros em todo `src/agent/`
- Zero imports de fora de `src/agent/`

**Estimativa:** M

**Requisitos:** RF-001, RF-026

---

### ENT-010: Determinismo e Polimento

**Objetivo:** Modo determinístico para testes, validação semântica de tools e refinamentos finais.

**Prioridade:** Could

**Itens:**
- Determinismo configurável (seed, temperature 0, disable memory/skills semântico)
- Validação semântica de tools (`tool.validate()` com contexto)
- Exemplo funcional (`example.ts`) com todos os cenários do PRD

**Dependências:**
- ENT-009 concluída

**Critérios de Aceite:**
- `deterministic: true` produz resultados consistentes
- `tool.validate()` executa com contexto de conversa
- Todos os 7 testes do PRD passam com `npx tsx src/agent/example.ts`

**Estimativa:** M

**Requisitos:** RF-027, RF-028

---

### ENT-011: Interfaces Plugáveis (Portabilidade)

**Objetivo:** Garantir que as interfaces VectorStore, MemoryStore e ConversationStore estão bem definidas e documentadas como pontos de extensão para substituir SQLite por outros backends.

**Prioridade:** Must

**Itens:**
- Interface `VectorStore` com 3 métodos: `upsert()`, `search()`, `delete()`
- Interface `MemoryStore` com 5 métodos: `save()`, `search()`, `list()`, `delete()`, `update()`
- Interface `ConversationStore` com 4 métodos: `save()`, `load()`, `delete()`, `list()`
- SQLite como implementação default de todas as interfaces
- Consumidor pode injetar stores alternativos via config:
  - `knowledge: { store: new PgVectorStore(...) }`
  - `memory: { store: new CustomMemoryStore(...) }`
  - `conversation: { store: new RedisConversationStore(...) }`

**Dependências:**
- ENT-003 concluída (SQLiteDatabase como implementação default)
- ENT-005 concluída (MemoryStore definida)
- ENT-006 concluída (VectorStore definida)

**Critérios de Aceite:**
- Cada interface é um contrato TypeScript exportado via `index.ts`
- Implementações SQLite passam todos os testes via interface (não acoplados à implementação)
- Consumidor pode trocar store sem alterar nenhum outro código
- Documentação de portabilidade reflete o GUIDE (VectorStore, MemoryStore, ConversationStore)

**Estimativa:** S

**Requisitos:** Princípio Arquitetural AP-02 (Interfaces plugáveis)

<!-- APPEND:deliverables -->

---

## Priorização

| Entrega | Prioridade | Dependências | Justificativa |
|---------|-----------|--------------|---------------|
| ENT-001: Fundação | Must | Nenhuma | Base para tudo — tipos, config, utils |
| ENT-002: LLM Layer | Must | ENT-001 | Sem LLM client, nada funciona |
| ENT-003: Storage | Must | ENT-001 | Persistência necessária para memory, knowledge, conversations |
| ENT-004: Tools | Must | ENT-001 | Tool calling é feature central do agente |
| ENT-005: Memory | Must | ENT-002, ENT-003 | Diferencial do agente — memória com aprendizado |
| ENT-006: Knowledge | Must | ENT-002, ENT-003 | RAG é feature Must do PRD |
| ENT-007: Skills | Must | ENT-001 | Feature documentada no GUIDE com 3 métodos de ativação, desempate e exclusive mode |
| ENT-008: Core | Must | ENT-002..ENT-007 | Orquestração — integra todos os subsistemas |
| ENT-009: Agent | Must | ENT-008 | Ponto de entrada — materializa a API pública |
| ENT-010: Polimento | Could | ENT-009 | Refinamentos para DX e testes |
| ENT-011: Portabilidade | Must | ENT-003, ENT-005, ENT-006 | Interfaces plugáveis são princípio arquitetural — GUIDE documenta troca de VectorStore, MemoryStore, ConversationStore |

---

## Riscos Técnicos

| Risco | Impacto | Probabilidade | Mitigação |
|-------|---------|---------------|-----------|
| SSE parsing do OpenRouter tem edge cases não documentados (reconnect, chunking parcial) | Alto | Média | Implementar parser robusto com testes contra respostas reais; retry com backoff |
| better-sqlite3 falha na compilação em ambientes sem build tools (node-gyp) | Médio | Média | Documentar pré-requisitos; testar em CI com múltiplas plataformas |
| Busca vetorial brute-force O(n) degrada com >100K vetores | Médio | Baixa | Log warning acima de 50K; documentar migração para VectorStore plugável |
| MCP SDK é dependência opcional — dynamic import pode ter edge cases | Médio | Média | Testes com e sem SDK instalado; erro amigável e documentado |
| Mutex por thread com Promise-based lock pode ter edge cases de deadlock | Alto | Baixa | Timeout no lock; testes de concorrência com múltiplas threads simultâneas |
| Compactação de histórico via LLM pode alterar contexto crítico | Médio | Média | Mensagens pinadas nunca compactadas; preservar últimas 10 intactas; testes de recall pós-compactação |
| Cost guard pode não ser preciso (estimativa de tokens vs real) | Baixo | Alta | Usar contagem real de tokens da resposta do OpenRouter; estimativa apenas para pre-check |

<!-- APPEND:technical-risks -->

---

## Dependências Externas

| Dependência | Tipo | Responsável | Status | Impacto se Atrasar |
|-------------|------|-------------|--------|---------------------|
| OpenRouter API | Serviço externo | OpenRouter (terceiro) | Disponível | Bloqueante — sem ele o agente não funciona. Mitigação: baseUrl configurável |
| better-sqlite3 (npm) | Biblioteca | WiseLibs (open source) | Disponível | Bloqueante — persistência local depende dele |
| zod (npm) | Biblioteca | Colin McDonnell (open source) | Disponível | Bloqueante — validação de config e tools |
| zod-to-json-schema (npm) | Biblioteca | Open source | Disponível | Bloqueante — conversão de tools para function calling |
| @modelcontextprotocol/sdk (npm) | Biblioteca (opcional) | Anthropic (open source) | Disponível | Não bloqueante — MCP é feature Should, dynamic import |

<!-- APPEND:external-dependencies -->
