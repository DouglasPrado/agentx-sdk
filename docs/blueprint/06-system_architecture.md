# Arquitetura do Sistema

## Introdução

Esta seção descreve a arquitetura de alto nível do **AgentX SDK**, incluindo seus componentes principais, como eles se comunicam e onde são implantados. O AgentX SDK é um pacote TypeScript standalone — não é um serviço deployável, mas sim uma biblioteca que roda dentro do processo Node.js da aplicação host.

---

## Componentes

> Quais são os blocos principais do sistema? Cada componente deve ter uma responsabilidade clara.

### Agent (ponto de entrada)

| Campo            | Descrição                                      |
| ---------------- | ---------------------------------------------- |
| **Nome**         | Agent                                          |
| **Responsabilidade** | Classe principal que orquestra todos os subsistemas. Expõe `chat()`, `stream()`, lifecycle e registro de tools/skills/MCP |
| **Tecnologia**   | TypeScript, Node.js 18+                        |
| **Interface**    | API programática (classe TypeScript)           |

### LLM Layer

| Campo            | Descrição                                      |
| ---------------- | ---------------------------------------------- |
| **Nome**         | OpenRouterClient + message-types + reasoning   |
| **Responsabilidade** | Comunicação HTTP com OpenRouter API: chat completions com streaming SSE, embeddings e structured output. Suporte a reasoning por família de modelo |
| **Tecnologia**   | `fetch()` nativo, SSE parsing manual           |
| **Interface**    | `streamChat()`, `chat()`, `embed()` — async    |

### Core Layer

| Campo            | Descrição                                      |
| ---------------- | ---------------------------------------------- |
| **Nome**         | ReactLoop + StreamEmitter + ContextBuilder + ContextPipeline + ConversationManager + ExecutionContext |
| **Responsabilidade** | Loop ReAct com error recovery, streaming com backpressure, construção de contexto com budget de tokens, isolamento de threads com mutex, tracing por execução |
| **Tecnologia**   | TypeScript puro, AsyncIterableIterator         |
| **Interface**    | `execute()` retorna `AsyncIterableIterator<AgentEvent>` |

### Storage Layer

| Campo            | Descrição                                      |
| ---------------- | ---------------------------------------------- |
| **Nome**         | SQLiteDatabase                                 |
| **Responsabilidade** | Wrapper centralizado de SQLite. Auto-create tables, migrations, WAL mode. Arquivo único para memórias, vetores e conversas |
| **Tecnologia**   | `better-sqlite3`                               |
| **Interface**    | `db` getter, `initialize()`, `close()`         |

### Memory Subsystem

| Campo            | Descrição                                      |
| ---------------- | ---------------------------------------------- |
| **Nome**         | MemoryManager + MemoryStore + SQLiteMemoryStore |
| **Responsabilidade** | Extração event-driven de fatos de conversas, recall com busca híbrida (FTS5 + embeddings + RRF), decay temporal de confidence, consolidação e feedback |
| **Tecnologia**   | SQLite FTS5, embeddings via OpenRouter, Reciprocal Rank Fusion |
| **Interface**    | `MemoryStore` interface (plugável)             |

### Knowledge Subsystem

| Campo            | Descrição                                      |
| ---------------- | ---------------------------------------------- |
| **Nome**         | KnowledgeManager + VectorStore + SQLiteVectorStore + EmbeddingService + Chunking |
| **Responsabilidade** | RAG completo: ingestão de documentos com chunking, geração de embeddings, armazenamento vetorial, busca por similaridade cosseno com cache |
| **Tecnologia**   | SQLite BLOB, cosseno em JS, cache LRU          |
| **Interface**    | `VectorStore` interface (plugável)             |

### Tools Subsystem

| Campo            | Descrição                                      |
| ---------------- | ---------------------------------------------- |
| **Nome**         | ToolExecutor + tool-types + MCPAdapter          |
| **Responsabilidade** | Registro de tools, conversão Zod → JSON Schema, execução parallel/sequential, validação semântica opcional. MCPAdapter converte tools MCP para AgentTool com dynamic import, reconnect e fault isolation |
| **Tecnologia**   | Zod, `zod-to-json-schema`, `@modelcontextprotocol/sdk` (opcional) |
| **Interface**    | `AgentTool` interface, MCP via stdio/SSE       |

### Skills Subsystem

| Campo            | Descrição                                      |
| ---------------- | ---------------------------------------------- |
| **Nome**         | SkillManager + skill-types                     |
| **Responsabilidade** | Registro de skills, matching em 3 níveis (prefix → custom → semântico), desempate por prioridade, injeção de instruções e tools no contexto |
| **Tecnologia**   | Embeddings opcionais via EmbeddingService      |
| **Interface**    | `AgentSkill` interface                         |

### Utils

| Campo            | Descrição                                      |
| ---------------- | ---------------------------------------------- |
| **Nome**         | Logger + TokenCounter + Retry + Cache          |
| **Responsabilidade** | Logger console-based com levels, estimativa de tokens i18n-aware, retry exponencial com backoff, cache LRU com TTL |
| **Tecnologia**   | TypeScript puro, zero dependências             |
| **Interface**    | Funções e classes utilitárias                   |

<!-- APPEND:components -->

---

## Diagrama de Componentes

> 📐 Diagrama: [container-diagram.mmd](../diagrams/containers/container-diagram.mmd)
>
> Para componentes internos, veja: [api-components.mmd](../diagrams/components/api-components.mmd)

---

## Comunicação

> Como os componentes se comunicam?

| De | Para | Protocolo | Tipo (sync/async) | Descrição |
| -- | ---- | --------- | ----------------- | --------- |
| Agent | ReactLoop | Chamada de método | Sync (async iterador) | Agent cria ReactLoop por execução e itera sobre eventos |
| ReactLoop | OpenRouterClient | HTTPS + SSE | Async (streaming) | Envia messages+tools, recebe stream de chunks |
| ReactLoop | ToolExecutor | Chamada de método | Async | Executa tools quando LLM retorna tool_calls |
| Agent | ContextPipeline | Chamada de método | Async | Constrói contexto antes de cada chamada ao ReactLoop |
| ContextPipeline | SkillManager | Chamada de método | Sync | Stage de skills detecta e injeta skills ativas |
| ContextPipeline | KnowledgeManager | Chamada de método | Async | Stage de knowledge busca RAG e injeta resultados |
| ContextPipeline | MemoryManager | Chamada de método | Async | Stage de memory busca memórias relevantes |
| ContextPipeline | ContextBuilder | Chamada de método | Async | Stage de history compacta histórico com budget |
| Agent | ConversationManager | Chamada de método | Sync | Lê/escreve histórico de threads com mutex |
| MemoryManager | SQLiteMemoryStore | Chamada de método | Sync | Persiste e busca memórias via SQLite + FTS5 |
| KnowledgeManager | SQLiteVectorStore | Chamada de método | Sync | Persiste e busca vetores via SQLite |
| KnowledgeManager | EmbeddingService | HTTPS (via OpenRouter) | Async | Gera embeddings para chunks e queries |
| MCPAdapter | MCP Server | stdio / SSE (MCP Protocol) | Async | Conecta, lista tools e executa tool calls remotamente |
| StreamEmitter | Consumidor (app host) | AsyncIterableIterator | Async (pull-based) | Entrega AgentEvents com backpressure |

<!-- APPEND:communication -->

---

## Infraestrutura e Deploy

> O AgentX SDK é uma biblioteca, não um serviço. Não há deploy próprio — ele roda dentro do processo da aplicação host.

### Ambientes

| Ambiente | Finalidade | Endpoint | Observações |
| -------- | ---------- | -------- | ----------- |
| **Dev** | Desenvolvimento e testes locais | `import { Agent } from './src/agent'` | SQLite em `:memory:` para testes, arquivo local para dev |
| **Test** | Testes automatizados (CI) | N/A | `deterministic: true` para reprodutibilidade, SQLite `:memory:` |
| **Prod** | Uso pela aplicação host em produção | N/A (lib embutida) | SQLite em `~/.agent/data.db` (configurável), WAL mode |

### Decisões de Infraestrutura

| Aspecto | Escolha |
| ------- | ------- |
| **Runtime** | Node.js 18+ (fetch nativo, dynamic import) |
| **Persistência** | SQLite via `better-sqlite3` — arquivo único, zero config |
| **LLM Gateway** | OpenRouter API (HTTPS + SSE) — único ponto de integração com LLMs |
| **Tools Externas** | MCP Protocol (stdio/SSE) via `@modelcontextprotocol/sdk` (opcional) |
| **Validação** | Zod + `zod-to-json-schema` |
| **CI/CD** | `tsc --noEmit` + testes automatizados (responsabilidade do consumidor) |
| **Monitoramento** | AgentEvents + ExecutionContext com traceId (integrável com OpenTelemetry, Datadog, etc.) |
| **Mensageria/Filas** | N/A — comunicação intra-processo via chamadas de método e AsyncIterator |

---

## Diagrama de Deploy

> 📐 Diagrama: [production.mmd](../diagrams/deployment/production.mmd)
