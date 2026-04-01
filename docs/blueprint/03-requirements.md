# Requisitos

---

## Requisitos Funcionais

> O que o sistema precisa fazer para resolver o problema descrito na Visão?

| ID | Descrição | Prioridade | Status |
|----|-----------|------------|--------|
| RF-001 | Classe `Agent` com `chat()` que retorna texto e `stream()` que retorna `AsyncIterableIterator<AgentEvent>` | Must | Proposto |
| RF-002 | `OpenRouterClient` com streaming SSE via `fetch()` nativo, suporte a chat completions e embeddings | Must | Proposto |
| RF-003 | Loop ReAct (`ReactLoop`) com tool calling, max iterations, timeout e error recovery configurável (`continue`/`stop`/`retry`) | Must | Proposto |
| RF-004 | `ToolExecutor` com registro de tools, validação Zod → JSON Schema, execução parallel/sequential | Must | Proposto |
| RF-005 | `AgentConfig` com validação Zod completa (apiKey, model, tools, memory, knowledge, skills, costPolicy, etc.) | Must | Proposto |
| RF-006 | Sistema de tipos (`types.ts`) com `AgentEvent`, `Memory`, `ContentPart`, `TokenUsage` e todos os tipos centrais | Must | Proposto |
| RF-007 | `StreamEmitter` com async push/pull channel, bounded queue e backpressure | Must | Proposto |
| RF-008 | `ConversationManager` com isolamento por threadId, mutex por thread e persistência opcional via `ConversationStore` | Must | Proposto |
| RF-009 | `ContextBuilder` com budget de tokens, ratios configuráveis (history/injection/reserve) e compactação de histórico via LLM | Must | Proposto |
| RF-010 | `ContextPipeline` com 5 stages ordenados (SystemPrompt → Skills → Knowledge → Memory → History) e corte por prioridade | Must | Proposto |
| RF-011 | `SQLiteDatabase` wrapper com auto-create tables, migrations e WAL mode | Must | Proposto |
| RF-012 | `MemoryManager` com extração event-driven + sampling, decay de confidence, consolidação e feedback | Must | Proposto |
| RF-013 | `MemoryStore` interface + `SQLiteMemoryStore` com FTS5 full-text search e busca híbrida (FTS5 + embeddings + RRF) | Must | Proposto |
| RF-014 | `KnowledgeManager` com ingest (chunking) + search (embeddings + cache) | Must | Proposto |
| RF-015 | `VectorStore` interface + `SQLiteVectorStore` com similaridade cosseno em JS e cache LRU de embeddings | Must | Proposto |
| RF-016 | `EmbeddingService` com embed() via OpenRouter e cache LRU com TTL | Must | Proposto |
| RF-017 | Estratégias de chunking: `FixedSizeChunking` e `RecursiveCharacterChunking` | Must | Proposto |
| RF-018 | `SkillManager` com matching em 3 níveis (triggerPrefix → match() customizado → semântico via embeddings) e desempate por prioridade | Must | Proposto |
| RF-019 | `MCPAdapter` com dynamic import de `@modelcontextprotocol/sdk`, reconexão automática com backoff, health check e isolamento de falhas por tool | Should | Proposto |
| RF-020 | `CostPolicy` com limites por execução (tokens + tool calls) e por sessão, com ação `stop` ou `warn` | Must | Proposto |
| RF-021 | `AgentHooks` (beforeToolCall, afterToolCall, transformContext, onEvent) | Should | Proposto |
| RF-022 | Suporte multimodal: `ContentPart` com `text` e `image_url` no input do `chat()`/`stream()` | Should | Proposto |
| RF-023 | Structured output via `responseFormat` (text, json_object, json_schema) | Should | Proposto |
| RF-024 | Mensagens pinadas (`pinned: true`) que sobrevivem à compactação de histórico | Should | Proposto |
| RF-025 | `ExecutionContext` com traceId, threadId, timing e parentTraceId para correlação de eventos | Should | Proposto |
| RF-026 | `ChatOptions` com overrides por request (model, systemPrompt, temperature, responseFormat, threadId) | Should | Proposto |
| RF-027 | Determinismo configurável (seed, temperature 0, disable memory extraction e skill matching semântico) | Could | Proposto |
| RF-028 | Validação semântica de tools (`tool.validate()` com contexto de conversa) | Could | Proposto |
| RF-029 | Reasoning support (`buildReasoningArgs()` por família de modelo, com effort levels) | Could | Proposto |
| RF-030 | Utilitários: Logger, TokenCounter (i18n-aware), Retry com backoff, Cache LRU com TTL | Must | Proposto |

<!-- APPEND:functional-requirements -->

**Legenda de Prioridade (MoSCoW):**
- **Must** — obrigatório para o lançamento; sem ele o sistema não resolve o problema
- **Should** — importante, mas o sistema funciona sem ele no curto prazo
- **Could** — desejável se houver tempo e recurso disponível
- **Won't** — fora do escopo desta versão, mas documentado para o futuro

---

## Requisitos Não Funcionais

> Quais são os limites aceitáveis de performance, disponibilidade e segurança?

| Categoria | Requisito | Métrica | Threshold |
|-----------|-----------|---------|-----------|
| Performance | Latência interna do Agent (excluindo LLM) | Overhead adicionado ao primeiro token | < 50ms |
| Performance | Busca vetorial em SQLite | Tempo de busca para 50K vetores | < 100ms |
| Performance | Busca FTS5 em memórias | Tempo de busca full-text | < 10ms |
| Performance | Cache hit rate de embeddings | % de cache hits em conversas repetitivas | > 60% |
| Escalabilidade | Vetores em SQLiteVectorStore | Máximo suportado com latência aceitável | ≤ 100K vetores |
| Escalabilidade | Threads concorrentes | Conversas simultâneas sem degradação | ≥ 100 threads |
| Escalabilidade | Mensagens pinadas por thread | Limite antes de auto-unpin | ≤ 20 |
| Manutenibilidade | Dependências diretas | Pacotes em `dependencies` | ≤ 4 |
| Manutenibilidade | Compilação TypeScript | `tsc --noEmit` sem erros | 0 erros |
| Manutenibilidade | Isolamento do pacote | Imports de fora de `src/agent/` | 0 referências |
| Manutenibilidade | Estrutura de arquivos | Total de arquivos no pacote | ~30 arquivos |
| Confiabilidade | Error recovery no ReactLoop | Comportamento com tool errors consecutivos | Para após maxConsecutiveErrors (default: 3) |
| Confiabilidade | Reconexão MCP | Tentativas automáticas com backoff | Até maxRetries (default: 3) |
| Confiabilidade | Cost guard | Execução para/avisa ao atingir limite | 100% enforcement |
| Segurança | API keys | Exposição de keys em logs ou eventos | Nunca exposta |
| Segurança | Tool execution | Validação de args antes de execução | Zod validation obrigatória |

<!-- APPEND:nonfunctional-requirements -->

---

## Matriz de Priorização

| Requisito | Valor de Negócio (1-5) | Esforço Técnico (1-5) | Risco (1-5) | Prioridade Final |
|-----------|------------------------|----------------------|-------------|-------------------|
| RF-001 Agent chat/stream | 5 | 4 | 2 | Alta |
| RF-002 OpenRouterClient | 5 | 3 | 3 | Alta |
| RF-003 ReactLoop | 5 | 4 | 3 | Alta |
| RF-004 ToolExecutor | 5 | 3 | 2 | Alta |
| RF-005 AgentConfig | 4 | 2 | 1 | Alta |
| RF-006 Types | 5 | 2 | 1 | Alta |
| RF-007 StreamEmitter | 5 | 3 | 3 | Alta |
| RF-008 ConversationManager | 4 | 3 | 2 | Alta |
| RF-009 ContextBuilder | 4 | 4 | 3 | Alta |
| RF-010 ContextPipeline | 4 | 3 | 2 | Alta |
| RF-011 SQLiteDatabase | 4 | 2 | 1 | Alta |
| RF-012 MemoryManager | 4 | 4 | 3 | Alta |
| RF-013 MemoryStore/SQLite | 4 | 3 | 2 | Alta |
| RF-014 KnowledgeManager | 4 | 3 | 2 | Alta |
| RF-015 VectorStore/SQLite | 3 | 3 | 2 | Média |
| RF-016 EmbeddingService | 4 | 2 | 2 | Alta |
| RF-017 Chunking | 3 | 2 | 1 | Média |
| RF-018 SkillManager | 5 | 3 | 2 | Alta |
| RF-019 MCPAdapter | 3 | 4 | 4 | Média |
| RF-020 CostPolicy | 5 | 2 | 1 | Alta |
| RF-021 AgentHooks | 3 | 2 | 1 | Média |
| RF-022 Multimodal | 3 | 2 | 1 | Média |
| RF-023 Structured output | 3 | 2 | 1 | Média |
| RF-024 Mensagens pinadas | 2 | 2 | 1 | Média |
| RF-025 ExecutionContext | 3 | 2 | 1 | Média |
| RF-026 ChatOptions overrides | 3 | 1 | 1 | Média |
| RF-027 Determinismo | 2 | 2 | 1 | Baixa |
| RF-028 Validação semântica | 2 | 3 | 2 | Baixa |
| RF-029 Reasoning support | 2 | 2 | 2 | Baixa |
| RF-030 Utilitários | 4 | 2 | 1 | Alta |

> Requisitos com alto valor de negócio e baixo esforço técnico são os candidatos ideais para as primeiras entregas. A Fase 1 (tipos + LLM + utils) e a Fase 2 (subsistemas) concentram os itens de prioridade Alta.
