# Fluxos Críticos

> Documente os 3 a 5 fluxos mais importantes do sistema. Estes são os caminhos que, se falharem, impactam diretamente o valor entregue.

---

## Fluxo 1: Stream Chat com Tool Calling

**Descrição:** O fluxo principal do sistema — o consumidor invoca `stream()` com input do usuário, o Agent constrói contexto, executa o loop ReAct com possíveis tool calls, e entrega eventos granulares via streaming. Crítico porque é a razão de existir do pacote.

**Atores envolvidos:** Aplicação Host, Agent, ContextPipeline, ReactLoop, OpenRouterClient, ToolExecutor

### Passos

1. Aplicação Host chama `agent.stream(input, options?)` com texto ou ContentPart[]
2. Agent cria `ExecutionContext` com traceId único
3. Agent adquire mutex da thread via `ConversationManager.withThread(threadId)`
4. Agent adiciona mensagem do usuário ao histórico da thread
5. Agent executa `ContextPipeline.execute()` — stages: SystemPrompt → Skills → Knowledge → Memory → History
6. ContextPipeline verifica budget de tokens e corta injections por prioridade se necessário
7. Agent cria `ReactLoop` e `StreamEmitter` para esta execução
8. ReactLoop chama `OpenRouterClient.streamChat()` com system prompt, messages e tools
9. OpenRouterClient faz fetch POST para OpenRouter API e itera sobre SSE chunks
10. ReactLoop emite `turn_start`, depois `text_delta` para cada chunk de texto
11. Se LLM retorna `tool_calls`: ReactLoop emite `tool_call_start` para cada tool
12. ReactLoop chama `ToolExecutor.execute()` (parallel ou sequential conforme config)
13. ToolExecutor valida args via Zod, executa `beforeToolCall` hook, roda tool, executa `afterToolCall` hook
14. ReactLoop emite `tool_call_end` com resultado e adiciona tool_results às messages
15. ReactLoop volta ao passo 8 (nova iteração) até LLM retornar texto sem tool_calls ou atingir maxIterations
16. ReactLoop emite `text_done` com texto completo, depois `turn_end` e `agent_end` com usage
17. Agent persiste mensagem do assistente no histórico e libera mutex
18. StreamEmitter fecha o canal — consumidor recebe fim do iterador

### Diagrama de Sequência

> 📐 Diagrama: [stream-chat-tool-calling.mmd](../diagrams/sequences/stream-chat-tool-calling.mmd)

### Tratamento de Erros

| Passo | Falha possível | Comportamento esperado |
|-------|---------------|----------------------|
| 3 | Mutex ocupado (outra execução na mesma thread) | Aguarda liberação do mutex — execuções na mesma thread são serializadas |
| 8-9 | OpenRouter API indisponível ou timeout | Retry com backoff exponencial (configurable). Após esgotamento, emite `error` event e para o loop |
| 9 | `finish_reason === 'length'` (context overflow) | Emite `warning` event com code `truncated`, trunca resposta e continua |
| 12-13 | Tool lança exceção | Conforme `onToolError`: `continue` → envia erro como tool_result ao LLM; `stop` → para loop; `retry` → re-executa 1x |
| 13 | Validação Zod falha nos args da tool | Retorna erro imediato como tool_result ao LLM — não executa a tool |
| 15 | `maxIterations` atingido | Emite `warning` e para o loop com o último texto disponível |
| 15 | `maxConsecutiveErrors` atingido | Emite `error` event e para o loop |
| 8 | `CostPolicy.maxTokensPerExecution` atingido | Se `stop`: emite `agent_end` com `reason: 'cost_limit'`; se `warn`: emite warning e continua (1x) |

### Requisitos de Performance

| Métrica | Valor esperado |
|---------|---------------|
| Overhead do Agent (excluindo LLM) | < 50ms |
| Time-to-first-token (excluindo LLM) | < 50ms |
| Throughput (execuções paralelas em threads diferentes) | ≥ 100 concorrentes |

---

## Fluxo 2: Memory Extraction e Recall

**Descrição:** O sistema extrai automaticamente fatos de conversas (event-driven + sampling) e os recupera em conversas futuras via busca híbrida. Crítico porque memória é o diferencial que torna o agente "inteligente" ao longo do tempo.

**Atores envolvidos:** Agent, MemoryManager, MemoryStore/SQLiteMemoryStore, EmbeddingService, OpenRouterClient

### Passos (Extração)

1. Após cada turno completo, Agent chama `MemoryManager.shouldExtract(messages)`
2. MemoryManager avalia triggers: extração explícita ("lembra que..."), turnos sem extração > 10, tool result significativo, feedback positivo, ou sampling (30%)
3. Se trigger ativado, MemoryManager chama OpenRouterClient com modelo de extração (pode ser modelo barato)
4. LLM analisa as últimas mensagens e retorna fatos estruturados (content, category, scope)
5. MemoryManager salva cada Memory via `MemoryStore.save()` com confidence inicial (0.8 ou 1.0)
6. SQLiteMemoryStore gera embedding via EmbeddingService e persiste no SQLite
7. SQLiteMemoryStore atualiza FTS5 index automaticamente
8. Agent emite `memory_extracted` event com memórias extraídas

### Passos (Recall)

1. Durante execução do ContextPipeline, MemoryStage chama `MemoryManager.recall(query)`
2. MemoryManager chama `MemoryStore.search(query, limit)`
3. SQLiteMemoryStore executa busca híbrida: FTS5 full-text (sem custo API) + similaridade cosseno (se embeddings disponíveis)
4. Resultados combinados via Reciprocal Rank Fusion (RRF) e ponderados por confidence
5. Memórias retornadas são injetadas no ContextFrame como ContextInjection
6. `access_count` incrementado e `confidence += 0.05` para memórias acessadas

### Diagrama de Sequência

> 📐 Diagrama: [memory-extraction-recall.mmd](../diagrams/sequences/memory-extraction-recall.mmd)

### Tratamento de Erros

| Passo | Falha possível | Comportamento esperado |
|-------|---------------|----------------------|
| 3 | OpenRouter indisponível para extração | Pula extração neste turno — não bloqueia o fluxo principal |
| 6 | EmbeddingService falha | Salva memória sem embedding — FTS5 still funciona para recall |
| 3-4 | Modelo retorna extração malformada | Descarta silenciosamente — log warning |
| 2 | maxMemories atingido | Aplica decay e remove memórias com menor confidence antes de salvar novas |

### Requisitos de Performance

| Métrica | Valor esperado |
|---------|---------------|
| FTS5 search | < 10ms |
| Busca híbrida (FTS5 + embeddings) | < 50ms |
| Extração (chamada LLM) | < 3s (não bloqueia resposta principal) |

---

## Fluxo 3: Knowledge Ingestion e RAG Search

**Descrição:** O consumidor ingere documentos que são divididos em chunks, embedados e armazenados. Na busca, os chunks mais relevantes são recuperados e injetados no contexto. Crítico porque RAG é a principal forma de dar ao agente conhecimento especializado.

**Atores envolvidos:** Aplicação Host, Agent, KnowledgeManager, ChunkingStrategy, EmbeddingService, VectorStore/SQLiteVectorStore

### Passos (Ingestão)

1. Aplicação Host chama `agent.ingestKnowledge({ content, metadata? })`
2. KnowledgeManager aplica ChunkingStrategy (FixedSize ou RecursiveCharacter) ao conteúdo
3. Cada chunk recebe ID único e metadata do documento original
4. KnowledgeManager chama `EmbeddingService.embed(chunks)` em batch
5. EmbeddingService verifica cache LRU — hits retornam sem chamada API
6. Para cache misses, EmbeddingService chama OpenRouter embeddings API
7. KnowledgeManager chama `VectorStore.upsert()` para cada chunk com embedding
8. SQLiteVectorStore serializa Float32Array para BLOB e persiste no SQLite

### Passos (Busca RAG)

1. Durante ContextPipeline, KnowledgeStage chama `KnowledgeManager.search(query, topK)`
2. KnowledgeManager verifica cache de resultados (LRU, TTL: 5min)
3. Se cache miss: gera embedding da query via EmbeddingService
4. KnowledgeManager chama `VectorStore.search(queryEmbedding, topK)`
5. SQLiteVectorStore carrega embeddings (com cache em memória), calcula cosseno, retorna top-K
6. Resultados são injetados no ContextFrame como ContextInjection com source "knowledge"

### Diagrama de Sequência

> 📐 Diagrama: [knowledge-rag.mmd](../diagrams/sequences/knowledge-rag.mmd)

### Tratamento de Erros

| Passo | Falha possível | Comportamento esperado |
|-------|---------------|----------------------|
| 4-6 | EmbeddingService/OpenRouter falha na ingestão | Ingestão falha — lança erro ao consumidor (não há fallback para embeddings) |
| 3 | EmbeddingService falha na busca | Retorna array vazio — agente responde sem contexto de knowledge |
| 5 | SQLite indisponível | Lança erro — persistência é obrigatória para ingestão |
| 5 | >100K vetores — latência degradada | Log warning. Consumidor deve migrar para VectorStore plugável |

### Requisitos de Performance

| Métrica | Valor esperado |
|---------|---------------|
| Ingestão (chunking + embedding + persist) | < 5s por documento típico (1-10 páginas) |
| Busca vetorial (50K vetores) | < 100ms |
| Cache hit (embedding ou resultado) | < 1ms |

---

## Fluxo 4: MCP Connection e Tool Execution

**Descrição:** O Agent conecta a servidores MCP externos, descobre tools dinamicamente, e as executa durante o ReactLoop como qualquer outra tool. Crítico porque MCP é o principal mecanismo de extensibilidade para integração com ferramentas externas.

**Atores envolvidos:** Aplicação Host, Agent, MCPAdapter, MCP Server (externo), ToolExecutor

### Passos

1. Aplicação Host chama `agent.connectMCP({ name, transport, command?, url?, timeout?, maxRetries? })`
2. MCPAdapter faz dynamic import de `@modelcontextprotocol/sdk` — se não instalado, lança erro amigável
3. MCPAdapter estabelece conexão com MCP Server (stdio: spawn processo; SSE: HTTP connection)
4. MCPAdapter lista tools do server via MCP protocol (`tools/list`)
5. MCPAdapter converte cada tool MCP para `AgentTool` (schema → Zod, execute → chamada MCP)
6. MCPAdapter registra as tools convertidas no `ToolExecutor`
7. Se `healthCheckInterval > 0`, MCPAdapter inicia heartbeat periódico
8. Durante ReactLoop, quando LLM solicita uma tool MCP, ToolExecutor executa via MCPAdapter
9. MCPAdapter envia `tools/call` ao MCP Server com timeout individual por tool
10. Resultado retornado ao ReactLoop como qualquer outro tool_call_end

### Diagrama de Sequência

> 📐 Diagrama: [mcp-connection.mmd](../diagrams/sequences/mcp-connection.mmd)

### Tratamento de Erros

| Passo | Falha possível | Comportamento esperado |
|-------|---------------|----------------------|
| 2 | `@modelcontextprotocol/sdk` não instalado | Lança erro: "Install @modelcontextprotocol/sdk to use MCP connections" |
| 3 | MCP Server não responde | Retry com backoff até maxRetries (default: 3). Após esgotamento, lança erro |
| 7 | Heartbeat falha (server caiu) | Status → "reconnecting". Reconexão automática com backoff. Tools removidas do ToolExecutor até reconexão |
| 9 | Tool MCP timeout | Se `isolateErrors: true`: apenas esta tool retorna erro. Outras tools do mesmo server continuam |
| 9 | Tool MCP lança erro | Comportamento segue `onToolError` config (continue/stop/retry) |
| 3 | Server desconecta mid-session | Reconexão automática. Execuções em andamento recebem erro |

### Requisitos de Performance

| Métrica | Valor esperado |
|---------|---------------|
| Conexão inicial (stdio) | < 2s |
| Conexão inicial (SSE) | < 3s |
| Tool execution via MCP | < timeout configurado (default: 30s) |
| Reconexão automática | < 10s (3 retries com backoff) |

---

## Fluxo 5: Context Pipeline com Budget Management

**Descrição:** O pipeline constrói o contexto completo (system prompt + skills + knowledge + memory + histórico) respeitando um budget de tokens. Quando o orçamento aperta, corta injections por prioridade e compacta histórico. Crítico porque determina o que o LLM "vê" a cada chamada.

**Atores envolvidos:** Agent, ContextPipeline, SkillsStage, KnowledgeStage, MemoryStage, HistoryStage, ContextBuilder

### Passos

1. Agent cria `ContextFrame` com systemPrompt, messages, tokenBudget (detectado por modelo) e injections vazio
2. **SystemPromptStage**: injeta system prompt base, contabiliza tokens
3. **SkillsStage**: chama `SkillManager.match(input)` → skills ativas injetam instructions com prioridade alta
4. **KnowledgeStage**: chama `KnowledgeManager.search(input)` → resultados injetados com prioridade média
5. **MemoryStage**: chama `MemoryManager.recall(input)` → memórias injetadas com prioridade média-baixa
6. **HistoryStage**: aplica windowing no histórico — preserva últimas 10 mensagens intactas
7. Se `tokensUsed > tokenBudget`: pipeline corta injections por prioridade (memory e knowledge primeiro, skills por último)
8. Se histórico ainda excede budget: ContextBuilder sumariza mensagens antigas via LLM (ou trunca se sem LLM de compactação)
9. Mensagens `pinned: true` nunca são sumarizadas — ficam intactas entre resumo e recentes
10. Pipeline retorna ContextFrame final com systemPrompt completo e messages compactadas

### Diagrama de Sequência

> 📐 Diagrama: [context-pipeline.mmd](../diagrams/sequences/context-pipeline.mmd)

### Tratamento de Erros

| Passo | Falha possível | Comportamento esperado |
|-------|---------------|----------------------|
| 4 | KnowledgeManager falha | Stage retorna frame sem injeção de knowledge — não bloqueia pipeline |
| 5 | MemoryManager falha | Stage retorna frame sem injeção de memory — não bloqueia pipeline |
| 8 | LLM de compactação falha | Fallback: trunca mensagens mais antigas ao invés de sumarizar |
| 7 | Budget insuficiente mesmo após cortes | Preserva apenas system prompt + últimas mensagens — emite warning |

### Requisitos de Performance

| Métrica | Valor esperado |
|---------|---------------|
| Pipeline completo (sem compactação LLM) | < 100ms |
| Pipeline com compactação LLM | < 3s (depende do modelo de compactação) |
| Token counting | < 5ms |

<!-- APPEND:flows -->
