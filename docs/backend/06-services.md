# Services

Define todos os services do backend — metodos, parametros, retorno, dependencias e fluxos detalhados. Esta e a camada de orquestracao de logica de negocio.

---

## Convencoes de Services

> Quais regras se aplicam a todos os services?

<!-- do blueprint: 06-system-architecture.md, 07-critical_flows.md -->
- Services orquestram logica de negocio e nao misturam SQL fora dos stores/repositorios
- Services recebem objetos TypeScript e retornam entidades, arrays ou iteradores async
- Operacoes batch e persistencias compostas usam transacao SQLite quando necessario
- Eventos de dominio e `AgentEvents` sao emitidos apos transicoes relevantes
- Services nao conhecem HTTP

---

## Catalogo de Services

> Para cada service, documente responsabilidade, dependencias e metodos.

### AgentRuntimeService

**Responsabilidade:** Orquestrar `chat()` e `stream()` fim a fim.

**Nao faz:** nao executa SQL direto, nao parseia SSE, nao define schemas de tools.

**Dependencias:** `ConversationManager`, `ContextPipeline`, `ReactLoop`, `ToolExecutor`, `MemoryManager?`, `KnowledgeManager?`

**Metodos:** `chat(input, options?)`, `stream(input, options?)`

### MemoryService

**Responsabilidade:** `remember`, `recall`, extração automatica, decay e consolidacao.

**Nao faz:** nao gerencia fluxo do LLM principal.

**Dependencias:** `MemoryStore`, `OpenRouterClient`, `EmbeddingService`

**Metodos:** `remember(content, scope?)`, `recall(query, opts?)`, `extract(messages)`, `applyDecay()`, `consolidate()`

### KnowledgeService

**Responsabilidade:** ingestao de documentos e busca RAG.

**Dependencias:** `VectorStore`, `EmbeddingService`, `ChunkingStrategy`

**Metodos:** `ingest(doc)`, `search(query, topK)`

### MCPService

**Responsabilidade:** conexao, reconexao e health de servidores MCP.

**Dependencias:** `MCPAdapter`, `ToolExecutor`

**Metodos:** `connect(config)`, `disconnect(name)`, `getHealth()`

<!-- APPEND:services -->

---

## Fluxos Detalhados

> Para cada metodo critico, descreva o fluxo passo-a-passo.

### AgentRuntimeService.stream() — Fluxo Detalhado

```
1. Recebe `input` e `ChatOptions`
2. Cria `ExecutionContext` e verifica CostPolicy de sessao
3. Adquire mutex da thread via `ConversationManager`
4. Persiste mensagem do usuario
5. Executa `ContextPipeline.execute()`
6. Instancia `ReactLoop` e `StreamEmitter`
7. Itera `OpenRouterClient.streamChat()`
8. Se houver `tool_calls`, chama `ToolExecutor.execute()`
9. Persiste resposta final e dispara extração de memory quando aplicavel
10. Emite `agent_end` e libera mutex
```

**Transacao:** parcial; append de historico e batches SQLite usam transacao local
**Idempotencia:** execucao identificada por `traceId`; writes de chunks/memorias usam IDs estaveis

### MemoryService.extract() — Fluxo Detalhado

1. Avalia triggers de extração
2. Chama modelo de extração barato no OpenRouter
3. Valida saida estruturada
4. Persiste cada memoria no `MemoryStore`
5. Gera embeddings quando possivel
6. Emite `memory_extracted`

**Transacao:** sim para salvar lote de memorias
**Idempotencia:** dedup por similaridade/consolidacao futura

### KnowledgeService.ingest() — Fluxo Detalhado

1. Recebe `KnowledgeDocument`
2. Aplica estrategia de chunking
3. Gera embeddings em batch
4. Persiste chunks com `VectorStore.upsert()`
5. Invalida cache de busca

**Transacao:** sim para batch de chunks
**Idempotencia:** `upsert` por ID do chunk

<!-- APPEND:fluxos -->


---

## Injecao de Dependencias

> Como os services recebem suas dependencias?

| Estrategia | Descricao |
| --- | --- |
| Constructor injection | Dependencias explicitas em classes de service |
| Factory functions | `createAgent(config)` compoe stores, managers e clients |
| Sem container obrigatorio | O pacote nao depende de framework de DI |

> (ver [07-llm-client.md](07-llm-client.md) para o client LLM usado pelos services)
