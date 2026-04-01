# Escopo

---

## Escopo Funcional

> Capacidades que serão entregues nesta iniciativa.

- Classe `Agent` OOP standalone com `chat()` e `stream()`
- OpenRouterClient com streaming SSE via `fetch()` nativo
- Loop ReAct com tool calling (parallel/sequential), error recovery e cost guard
- Sistema de memória com extração automática, decay, consolidação e busca híbrida (FTS5 + embeddings)
- RAG local com ingestão, chunking, embeddings e busca vetorial via SQLite
- Sistema de skills com matching por prefix, função customizada e similaridade semântica
- Integração com servidores MCP (conexão, reconexão, isolamento de falhas)
- Persistência local via SQLite (conversas, memórias, vetores)
- Pipeline de contexto com budget de tokens e compactação de histórico
- Controle de custo por execução e por sessão
- Suporte multimodal (text + image_url)
- Structured output (json_object, json_schema)
- Mensagens pinadas que sobrevivem à compactação
- Hooks (beforeToolCall, afterToolCall, transformContext, onEvent)
- Determinismo configurável para testes

<!-- APPEND:functional-scope -->

---

## Escopo Técnico

- **Serviços a criar:** Pacote standalone em `src/agent/` (~30 arquivos)
- **Serviços a alterar:** Nenhum — 100% independente do dify-agent
- **Bancos impactados:** SQLite local (`~/.agent/data.db`) — novo, sem migração
- **Filas impactadas:** Nenhuma — comunicação intra-processo via AsyncIterator
- **Contratos impactados:** Nenhum — pacote novo sem consumidores existentes

---

## Fora de Escopo

- UI/frontend — é uma biblioteca programática
- API HTTP/REST/GraphQL — consumidor monta seu próprio servidor
- Autenticação de usuários finais — responsabilidade da aplicação host
- Hosting ou gerenciamento de servidores MCP
- Billing ou cotas do OpenRouter — apenas contabiliza tokens localmente
- Suporte a browser/edge — requer Node.js 18+ com filesystem
- Multi-provider nativo — exclusivamente OpenRouter
- Fine-tuning ou treinamento de modelos
- Substituição ou deprecação do dify-agent

---

## Fases de Entrega

| Fase | Objetivo | Conteúdo | Dependências |
| ---- | -------- | -------- | ------------ |
| Fase 1 — Fundação | Tipos + LLM + Utils | `types.ts`, `config.ts`, `logger.ts`, `token-counter.ts`, `retry.ts`, `cache.ts`, `message-types.ts`, `reasoning.ts`, `openrouter-client.ts` | Nenhuma |
| Fase 2 — Subsistemas | Tools + Storage + Memory + Knowledge + Skills | `tool-types.ts`, `tool-executor.ts`, `mcp-adapter.ts`, `sqlite-database.ts`, `memory-*`, `knowledge-*`, `skill-*` | Fase 1 |
| Fase 3 — Core | Loop + Contexto + Agent | `execution-context.ts`, `stream-emitter.ts`, `conversation-manager.ts`, `context-pipeline.ts`, `context-builder.ts`, `react-loop.ts`, `agent.ts`, `index.ts` | Fases 1 e 2 |
