# Glossario Ubiquo

> **Fonte unica de termos do dominio.** Todos os blueprints (tecnico, backend, frontend, business) devem usar estes termos. Nao crie glossarios separados — referencie este arquivo.

| Termo | Definicao | Nao Confundir Com | Usado em |
| --- | --- | --- | --- |
| Agent | Entidade principal que orquestra conversacao com LLM, gerenciando tools, memory, knowledge, skills e o loop ReAct | Agente de suporte / chatbot (Agent e a lib, nao o produto final) | Entidade core, API publica |
| AgentEvent | Unidade atomica de comunicacao do Agent — evento granular emitido via streaming (text_delta, tool_call_start, etc.) | Evento de dominio / evento de negocio | Streaming, observabilidade |
| ReactLoop | Ciclo iterativo: envia mensagens ao LLM → recebe resposta → se tool_calls, executa tools → repete ate texto final ou limite | Event loop do Node.js | Core loop, execucao |
| Tool (AgentTool) | Funcao externa que o Agent pode invocar durante o ReactLoop, definida com schema Zod | Ferramenta CLI / MCP tool (antes da conversao) | Tools, ToolExecutor |
| Skill (AgentSkill) | Conjunto de instrucoes + tools que modifica o comportamento do Agent quando ativado por matching de input | Plugin / extensao (skill e mais leve) | Skills, ContextPipeline |
| Memory | Fato extraido de conversas que persiste entre sessoes, com scope, confidence e ciclo de decay | Cache / historico de conversa (memory e semantica) | MemoryManager, MemoryStore |
| Knowledge | Documento ingerido para RAG, dividido em chunks com embeddings para busca vetorial | Memory (knowledge e documental, memory e conversacional) | KnowledgeManager, VectorStore |
| Thread | Contexto isolado de conversa identificado por threadId, com historico e mutex proprios | Thread de OS / worker thread | ConversationManager |
| ContentPart | Unidade de conteudo multimodal — texto ou image_url | Chunk de knowledge (ContentPart e input, chunk e armazenamento) | Multimodal, ChatMessage |
| ContextPipeline | Pipeline ordenado de stages que constroi o contexto respeitando budget de tokens | Middleware pipeline (ContextPipeline e especifico para construcao de prompt) | Core, ContextBuilder |
| CostPolicy | Politica de limites de custo por execucao e por sessao que previne consumo descontrolado | Rate limiting (CostPolicy e sobre tokens/custo, nao requests) | Agent, ReactLoop |
| StreamEmitter | Canal async push/pull com bounded queue e backpressure para entrega de AgentEvents | EventEmitter do Node.js (StreamEmitter tem backpressure) | Streaming |
| ExecutionContext | Contexto de rastreamento com traceId unico por execucao chat/stream | Context de request HTTP | Observabilidade, tracing |
| MCP | Model Context Protocol — protocolo para conectar tools externas via stdio ou SSE | RPC / gRPC (MCP e especifico para tools de LLM) | MCPAdapter |
| Embedding | Representacao vetorial de texto para busca por similaridade semantica | Encoding / tokenizacao | EmbeddingService, VectorStore |

<!-- APPEND:termos -->

---

## Acronimos

| Sigla | Significado | Contexto |
| --- | --- | --- |
| RAG | Retrieval-Augmented Generation | Knowledge, busca vetorial |
| FTS | Full-Text Search | MemoryStore, SQLite FTS5 |
| RRF | Reciprocal Rank Fusion | Busca hibrida (FTS + embeddings) |
| SSE | Server-Sent Events | OpenRouter streaming, MCP transport |
| LRU | Least Recently Used | Cache de embeddings e knowledge |
| TTL | Time To Live | Cache expiration |
| WAL | Write-Ahead Logging | SQLite concorrencia |
| MCP | Model Context Protocol | Tools externas |
| ADR | Architecture Decision Record | Decisoes |
| MoSCoW | Must/Should/Could/Won't | Priorizacao |

<!-- APPEND:acronimos -->

---

## Convencoes de Nomenclatura

> Regras que se aplicam a todos os blueprints.

| Contexto | Convencao | Exemplo |
| --- | --- | --- |
| Entidades/Classes | PascalCase, singular, ingles | Agent, Memory, ToolExecutor |
| Interfaces | PascalCase, prefixo descritivo | MemoryStore, VectorStore, AgentTool |
| Campos/Atributos | camelCase, ingles | threadId, accessCount, lastAccessedAt |
| Colunas SQLite | snake_case, ingles | thread_id, access_count, last_accessed_at |
| Tipos de evento | snake_case, ingles | text_delta, tool_call_start, agent_end |
| Arquivos | kebab-case, ingles | react-loop.ts, memory-manager.ts |
| Constantes | UPPER_SNAKE_CASE | MAX_ITERATIONS, DEFAULT_TIMEOUT |
| Enums/Scopes | lowercase, ingles | thread, persistent, learned |

<!-- APPEND:convencoes -->

> Este arquivo e referenciado por:
> - `docs/blueprint/04-domain-model.md` (glossario de dominio)
> - `docs/backend/03-domain.md` (implementacao de entidades)
> - `docs/frontend/04-components.md` (nomes de componentes baseados no dominio)
> - `docs/business/00-business-context.md` (termos de negocio)
