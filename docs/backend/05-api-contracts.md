# API Publica

Define todos os metodos publicos, tipos de entrada/saida e erros por operacao. Este documento e o contrato entre o pacote e o consumidor (host app).

---

## Convencoes Gerais

> Quais padroes se aplicam a toda a API publica?

<!-- do blueprint: 08-use_cases.md, 16-evolution.md -->
| Aspecto | Convencao |
| --- | --- |
| Superficie | API TypeScript publica |
| Formato | objetos TypeScript + `Promise` + `AsyncIterableIterator<AgentEvent>` |
| Autenticacao | `apiKey` no `AgentConfig` para OpenRouter; sem auth de usuario final |
| Versionamento | SemVer do pacote e da API exportada por `index.ts` |
| Erros | Excecoes tipadas (`AppError` subclasses) + eventos `error/warning` |
| Streaming | `stream()` e o contrato primario |

---

## Mapa de Metodos Publicos

> Lista completa de todos os metodos agrupados por dominio.

### Agent (entry point)

| Metodo | Entrada | Delega Para | Descricao |
| --- | --- | --- | --- |
| `chat(input, options?)` | `string \| ContentPart[], ChatOptions?` | `ReactLoop` via runtime | Retorna texto final |
| `stream(input, options?)` | `string \| ContentPart[], ChatOptions?` | `ReactLoop` via runtime | Retorna `AsyncIterableIterator<AgentEvent>` |
| `addTool(tool)` | `AgentTool` | `ToolExecutor` | Registra tool local |
| `removeTool(name)` | `string` | `ToolExecutor` | Remove tool |
| `addSkill(skill)` | `AgentSkill` | `SkillManager` | Registra skill |
| `connectMCP(config)` | `MCPConnectionConfig` | `MCPAdapter` | Conecta server MCP |
| `disconnectMCP()` | — | `MCPAdapter` | Desconecta MCP |
| `ingestKnowledge(doc)` | `KnowledgeDocument` | `KnowledgeManager` | Ingestao RAG |
| `remember(content, scope?)` | `string, MemoryScope?` | `MemoryManager` | Persistencia explicita |
| `recall(query)` | `string` | `MemoryManager` | Busca de memorias |
| `getUsage()` | — | acumulador interno | Le custo acumulado |
| `getHistory(threadId?)` | `string?` | `ConversationManager` | Historico de mensagens |
| `destroy()` | — | lifecycle | Cleanup de recursos |

<!-- APPEND:metodos -->

---

## Detalhamento por Metodo

> Para CADA metodo publico, documente entrada, saida e erros.

### `chat(input, options?)` — Chat simples com retorno textual

**Request:**

| Campo | Tipo | Obrigatorio | Validacao | Exemplo |
| --- | --- | --- | --- | --- |
| `input` | `string | ContentPart[]` | sim | nao vazio | `"Ola"` |
| `options.model` | `string` | nao | override opcional | `"openai/gpt-4o"` |
| `options.threadId` | `string` | nao | nao vazio | `"support-123"` |
| `options.responseFormat` | `text | json_object | json_schema` | nao | schema coerente | `{ type: 'json_object' }` |

**Response sucesso:**

```json
"texto final do assistente"
```

**Erros:**

| Tipo | Codigo | Mensagem | Quando |
| --- | --- | --- | --- |
| Exception | `INVALID_CONFIG` | Configuracao invalida | `AgentConfig` rejeitado |
| Exception | `OPENROUTER_ERROR` | Falha na chamada ao modelo | timeout, 429, 5xx apos retries |
| Exception | `SESSION_COST_LIMIT_EXCEEDED` | Orcamento da sessao esgotado | `maxTokensPerSession` atingido |
| Exception | `EXECUTION_ABORTED` | Execucao cancelada | `AbortSignal` disparado |

### `stream(input, options?)` — Streaming de eventos

**Request:** mesmo contrato de `chat`, com retorno `AsyncIterableIterator<AgentEvent>`.

**Response sucesso:** sequencia de eventos `agent_start`, `turn_start`, `text_delta`, `tool_call_start`, `tool_call_end`, `text_done`, `turn_end`, `agent_end`, `error`, `warning`.

**Erros:** mesmos erros de `chat`, com falhas recuperaveis emitidas como eventos quando possivel.

### `ingestKnowledge(document)` — Ingestao de knowledge

**Request:**

| Campo | Tipo | Obrigatorio | Validacao | Exemplo |
| --- | --- | --- | --- | --- |
| `content` | `string` | sim | nao vazio | `"Manual do produto..."` |
| `metadata` | `Record<string, unknown>` | nao | serializavel | `{ title: 'Manual' }` |

**Response sucesso:** `Promise<void>`

**Erros:** `EMBEDDING_FAILED`, `VECTORSTORE_WRITE_FAILED`, `SQLITE_ERROR`

### `remember(content, scope?)` — Persistencia explicita de memoria

**Request:** `content: string`, `scope?: 'thread' | 'persistent' | 'learned'`

**Response sucesso:** objeto `Memory`

**Erros:** `VALIDATION_ERROR`, `MEMORY_LIMIT_REACHED`, `SQLITE_ERROR`

### `recall(query)` — Busca de memorias

**Request:** `query: string`

**Response sucesso:** `Memory[]` ordenado por relevancia e confidence

**Erros:** `VALIDATION_ERROR`, `MEMORY_SEARCH_FAILED`

### `connectMCP(config)` — Conexao MCP

**Request:** `name`, `transport`, `command?`, `args?`, `url?`, `timeout?`, `maxRetries?`

**Response sucesso:** `Promise<void>`

**Erros:** `MCP_SDK_MISSING`, `MCP_CONNECTION_FAILED`, `MCP_TIMEOUT`

<!-- APPEND:detalhamento -->


---

## DTOs (Data Transfer Objects)

> Quais DTOs existem e quais campos possuem?

### Request DTOs

| DTO | Campos | Usado em |
| --- | --- | --- |
| `AgentConfig` | `apiKey, model, tools, memory, knowledge, skills, costPolicy...` | `new Agent(config)` |
| `ChatOptions` | `model, systemPrompt, temperature, responseFormat, threadId` | `chat`, `stream` |
| `KnowledgeDocumentInput` | `content, metadata?` | `ingestKnowledge` |
| `MCPConnectionConfig` | `name, transport, command?, url?, timeout?, maxRetries?` | `connectMCP` |

### Response DTOs

| DTO | Campos | Exclui | Usado em |
| --- | --- | --- | --- |
| `AgentEvent` | `type, traceId, threadId?, duration?, usage?, data` | credenciais e segredos | `stream` |
| `Memory` | `id, content, scope, category, confidence...` | segredos externos | `remember`, `recall` |
| `RetrievedKnowledge` | `id, content, metadata, score` | embedding bruto | `KnowledgeManager.search` |

<!-- APPEND:dtos -->

> (ver [06-services.md](06-services.md) para a logica que cada metodo executa)
