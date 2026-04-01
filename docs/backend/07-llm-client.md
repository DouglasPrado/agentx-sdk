# LLM Client

Define o client HTTP para comunicacao com o OpenRouter, streaming SSE, embeddings e reasoning por familia de modelo.

---

## Visao Geral

> Qual componente e responsavel pela comunicacao com LLMs?

<!-- do blueprint: 06-system-architecture.md, 10-architecture_decisions.md -->
| Aspecto | Decisao |
| --- | --- |
| Classe | `OpenRouterClient` |
| Arquivo | `src/agent/llm/openrouter-client.ts` |
| Protocolo | HTTPS + SSE (Server-Sent Events) |
| Gateway | OpenRouter API (unico provider) |
| HTTP Client | `fetch()` nativo (Node 22+) |
| Dependencias | Zero — sem SDK de LLM |

---

## OpenRouterClient

> Quais metodos o client expoe e como funcionam?

### Interface

```typescript
class OpenRouterClient {
  constructor(config: { apiKey: string; model: string; baseUrl?: string });

  async *streamChat(params: StreamChatParams): AsyncIterableIterator<StreamChunk>;
  async chat(params: ChatParams): Promise<ChatResponse>;
  async embed(texts: string[], model?: string): Promise<number[][]>;
}
```

### Metodos

| Metodo | Endpoint Externo | Entrada | Saida | Descricao |
| --- | --- | --- | --- | --- |
| `streamChat(params)` | `POST /chat/completions` | `StreamChatParams` | `AsyncIterableIterator<StreamChunk>` | Streaming SSE com texto e tool calls |
| `chat(params)` | `POST /chat/completions` | `ChatParams` | `ChatResponse` | Resposta completa (nao-streaming) |
| `embed(texts, model?)` | `POST /embeddings` | `string[]` | `number[][]` | Gera embeddings para textos |

### StreamChatParams

| Campo | Tipo | Obrigatorio | Descricao |
| --- | --- | --- | --- |
| `messages` | `ChatMessage[]` | sim | Historico de mensagens |
| `tools` | `ToolDef[]` | nao | Schemas de tools disponiveis |
| `temperature` | `number` | nao | Override de temperature |
| `responseFormat` | `ResponseFormat` | nao | Structured output |
| `signal` | `AbortSignal` | nao | Cancelamento |
| `seed` | `number` | nao | Determinismo |
| `maxTokens` | `number` | nao | Limite de tokens na resposta |

---

## Streaming SSE

> Como o streaming e implementado?

### Parsing de SSE

```text
data: {"choices":[{"delta":{"content":"Ola"}}]}
data: {"choices":[{"delta":{"tool_calls":[...]}}]}
data: [DONE]
```

| Aspecto | Implementacao |
| --- | --- |
| Parser | `ReadableStream` nativo + split por `\n\n` |
| Chunks de texto | Emitidos como `StreamChunk` com `type: 'content'` |
| Tool calls | Acumulados incrementalmente em `StreamChunk` com `type: 'tool_call'` |
| Fim do stream | `data: [DONE]` ou `finish_reason` presente |
| Erros mid-stream | Yield erro e fechamento do iterator |
| Backpressure | Controlado pelo consumidor (pull-based via `AsyncIterableIterator`) |

### StreamChunk (tipos de chunk)

```typescript
type StreamChunk =
  | { type: 'content'; data: string }
  | { type: 'tool_call'; id: string; name: string; arguments: string }
  | { type: 'reasoning'; data: string }
  | { type: 'done'; finishReason: string; usage?: TokenUsage };
```

---

## Message Types

> Quais tipos representam mensagens e respostas?

### ChatMessage (multimodal)

```typescript
interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[];
  tool_calls?: ToolCallMessage[];
  tool_call_id?: string;
  name?: string;
}

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } };
```

### TokenUsage

```typescript
interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}
```

---

## Reasoning por Familia de Modelo

> Como o client adapta parametros de reasoning por modelo?

**Arquivo:** `src/agent/llm/reasoning.ts`

```typescript
function buildReasoningArgs(model: string): Partial<StreamChatParams>;
```

| Familia | Comportamento | Parametros Especiais |
| --- | --- | --- |
| `anthropic/claude-*` | Extended thinking quando disponivel | `thinking` parameter |
| `openai/o1-*` | Reasoning nativo | sem `temperature`, sem `system` role |
| `openai/gpt-4o*` | Padrao | nenhum ajuste |
| `google/gemini-*` | Padrao | nenhum ajuste |
| Outros | Padrao generico | nenhum ajuste |

---

## Resiliencia

> Como o client lida com falhas?

| Cenario | Estrategia | Configuracao |
| --- | --- | --- |
| HTTP 429 (rate limit) | Retry com backoff exponencial | `retry.ts` util |
| HTTP 5xx | Retry com backoff | max 3 tentativas |
| Timeout | `AbortSignal` com deadline | configuravel por chamada |
| `finish_reason: 'length'` | Yield warning event, truncar resposta | tratado no `ReactLoop` |
| Rede indisponivel | Erro imediato | sem retry para `ECONNREFUSED` |

### Circuit Breaker

| Parametro | Valor Padrao |
| --- | --- |
| Threshold de falhas | 5 consecutivas |
| Estado aberto | 30s |
| Half-open | 1 chamada de teste |
| Fallback | Falhar explicitamente ou degradar subsistema |

---

## Embeddings

> Como embeddings sao gerados?

| Aspecto | Decisao |
| --- | --- |
| Endpoint | `POST /embeddings` via OpenRouter |
| Modelo padrao | Configuravel via `knowledge.embeddingModel` |
| Batch | Suporta multiplos textos por chamada |
| Cache | LRU em memoria (key: hash do texto, TTL: 1h, max: 10K) |
| Fallback | Sem embedding = busca apenas por FTS5 |

**Classe:** `EmbeddingService` (`src/agent/knowledge/embedding-service.ts`)

```typescript
class EmbeddingService {
  constructor(client: OpenRouterClient, cache?: LRUCache<string, number[]>);
  async embed(texts: string[]): Promise<number[][]>;
  async embedSingle(text: string): Promise<number[]>;
}
```

---

## Configuracao

> Quais parametros controlam o client?

| Parametro | Fonte | Default | Descricao |
| --- | --- | --- | --- |
| `apiKey` | `AgentConfig.apiKey` | obrigatorio | Credencial do OpenRouter |
| `model` | `AgentConfig.model` | `anthropic/claude-sonnet-4` | Modelo padrao |
| `baseUrl` | `AgentConfig.baseUrl` | `https://openrouter.ai/api/v1` | Override do endpoint |
| `temperature` | `AgentConfig.temperature` ou `ChatOptions.temperature` | indefinido (padrao do modelo) | Criatividade |

> (ver [08-hooks-pipeline.md](08-hooks-pipeline.md) para como o contexto e montado antes de chamar o client)
