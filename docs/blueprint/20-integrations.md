# Integrações e Interfaces

---

## APIs Expostas

> O AgentX SDK é uma biblioteca TypeScript. Suas "APIs" são interfaces programáticas, não endpoints HTTP.

| Interface | Consumidor | Método | Objetivo | Contrato |
| --------- | ---------- | ------ | -------- | -------- |
| `Agent.chat()` | Aplicação host | Async method | Conversa single-turn com resposta completa | `(input: string \| ContentPart[], options?: ChatOptions) => Promise<string>` |
| `Agent.stream()` | Aplicação host | Async iterator | Conversa com streaming de eventos | `(input: string \| ContentPart[], options?: ChatOptions) => AsyncIterableIterator<AgentEvent>` |
| `Agent.addTool()` | Aplicação host | Sync method | Registrar tool para o LLM usar | `(tool: AgentTool) => void` |
| `Agent.addSkill()` | Aplicação host | Sync method | Registrar skill com instruções e tools | `(skill: AgentSkill) => void` |
| `Agent.connectMCP()` | Aplicação host | Async method | Conectar a servidor MCP externo | `(config: MCPConnectionConfig) => Promise<void>` |
| `Agent.disconnectMCP()` | Aplicação host | Async method | Desconectar de servidores MCP | `() => Promise<void>` |
| `Agent.getHealth()` | Aplicação host | Sync method | Status dos MCP servers conectados | `() => { servers: MCPHealthStatus[] }` |
| `Agent.ingestKnowledge()` | Aplicação host | Async method | Ingerir documento para RAG | `(doc: KnowledgeDocument) => Promise<void>` |
| `Agent.remember()` | Aplicação host | Async method | Salvar memória explícita | `(fact: string, scope?: MemoryScope) => Promise<void>` |
| `Agent.recall()` | Aplicação host | Async method | Buscar memórias relevantes | `(query: string) => Promise<Memory[]>` |
| `Agent.getUsage()` | Aplicação host | Sync method | Consultar custo acumulado | `() => TokenUsage` |
| `Agent.destroy()` | Aplicação host | Async method | Limpar recursos e fechar conexões | `() => Promise<void>` |

<!-- APPEND:apis -->

---

## Eventos Emitidos

> Eventos granulares emitidos via `AsyncIterableIterator<AgentEvent>` durante `stream()`.

| Evento | Quando Ocorre | Payload Principal | Consumidor |
| ------ | ------------- | ----------------- | ---------- |
| `agent_start` | Início de execução | `traceId` | App host (logging) |
| `agent_end` | Fim de execução | `traceId, usage: TokenUsage, duration` | App host (billing, logging) |
| `turn_start` / `turn_end` | Cada iteração do ReactLoop | `traceId, iteration` | App host (progress) |
| `thinking` | LLM emite reasoning | `data: string` | App host (debug) |
| `text_delta` | Chunk de texto do LLM | `data: string` | App host (streaming UI) |
| `text_done` | Texto completo | `fullText: string` | App host |
| `tool_call_start` | LLM solicita tool | `id, tool, args` | App host (logging, UI) |
| `tool_call_end` | Tool retorna resultado | `id, tool, result, isError, duration` | App host (logging) |
| `memory_extracted` | Memórias extraídas da conversa | `memories: Memory[]` | App host (debug) |
| `knowledge_retrieved` | Knowledge recuperado via RAG | `sources: RetrievedKnowledge[]` | App host (debug) |
| `skill_activated` | Skill detectada e ativada | `skill: string` | App host (debug) |
| `warning` | Truncamento, rate limit, etc. | `message, code?` | App host (alertas) |
| `error` | Erro na execução | `error, code?` | App host (error handling) |
| `context_snapshot` | Debug do contexto enviado ao LLM | `snapshot: ContextSnapshot` | App host (auditoria) |

<!-- APPEND:events -->

---

## Interfaces Plugáveis (Extensão)

> Interfaces que o consumidor pode implementar para substituir comportamento padrão.

| Interface | Implementação Default | Propósito | Quando Trocar |
| --------- | -------------------- | --------- | ------------- |
| `MemoryStore` | `SQLiteMemoryStore` | Persistência de memórias + busca | Migrar para Postgres, Redis, etc. |
| `VectorStore` | `SQLiteVectorStore` | Armazenamento e busca vetorial | Volume > 100K vetores (PgVector, Pinecone) |
| `ConversationStore` | SQLite (via ConversationManager) | Persistência de histórico | Migrar para Redis, DynamoDB, etc. |
| `ChunkingStrategy` | `FixedSizeChunking`, `RecursiveCharacterChunking` | Divisão de documentos para RAG | Chunking semântico customizado |

---

## Integrações Externas

| Integração | Protocolo | Tipo | Contrato | Retry/Fallback |
| ---------- | --------- | ---- | -------- | -------------- |
| OpenRouter API | HTTPS + SSE | Síncrono (chat) + Streaming (SSE) | OpenAI-compatible chat completions | Retry com backoff + ModelFallbackChain |
| Servidores MCP | stdio / SSE (MCP Protocol) | Async | `@modelcontextprotocol/sdk` | Reconexão automática (maxRetries: 3) + healthcheck |

---

## Política de Versionamento

- **Semantic Versioning (semver):** Mudanças em interfaces públicas (`Agent`, `AgentConfig`, `AgentEvent`) seguem semver
- **Interfaces plugáveis:** `MemoryStore`, `VectorStore`, `ConversationStore` são contratos estáveis — breaking changes apenas em major versions
- **AgentEvent:** Novos tipos de evento podem ser adicionados em minor versions (additive)
