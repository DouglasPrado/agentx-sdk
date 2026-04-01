# Integracoes Externas

Define os clients de APIs externas — metodos, timeout, retry, circuit breaker e fallback para cada integracao.

---

## Catalogo de Integracoes

> Quais servicos externos o backend consome?

<!-- do blueprint: 00-context.md, 06-system-architecture.md, 17-communication.md -->
| Servico | Funcao | Protocolo | Criticidade | SLA |
| --- | --- | --- | --- | --- |
| OpenRouter API | Chat completions, streaming SSE e embeddings | HTTPS + SSE | Critica | Dependencia externa principal |
| Servidores MCP | Tools dinamicas | stdio / SSE | Media | Opcional |
| SQLite local | Persistencia local | biblioteca embutida | Alta | Dependente do filesystem |

<!-- APPEND:catalogo -->

---

## Detalhamento por Integracao

> Para CADA servico externo, documente o client, metodos, resiliencia e configuracao.

### OpenRouter API

**Funcao:** gateway unico de LLM e embeddings.

**Client Class:** `OpenRouterClient`

**Metodos:**

| Metodo | Endpoint Externo | Timeout | Retry | Descricao |
| --- | --- | --- | --- | --- |
| `streamChat(messages, options)` | `POST /chat/completions` | configuravel | 429/5xx com backoff | streaming SSE com texto/tool calls |
| `chat(messages, options)` | `POST /chat/completions` | configuravel | 429/5xx com backoff | resposta completa |
| `embed(input)` | `POST /embeddings` | configuravel | 429/5xx com backoff | gera embeddings |

**Circuit Breaker:**

| Parametro | Valor |
| --- | --- |
| Threshold | 5 falhas consecutivas |
| Estado aberto | 30s |
| Half-open | 1 chamada de teste |
| Fallback | falhar explicitamente ou degradar stage (memory/knowledge) |

**Configuracao:**

- Credencial via `AgentConfig.apiKey` — passada programaticamente pelo consumidor
- Base URL override via `AgentConfig.baseURL` (opcional)

### MCP Server

**Funcao:** disponibilizar tools externas em runtime.

**Client Class:** `MCPAdapter`

**Metodos:** `connect()`, `listTools()`, `callTool()`, `disconnect()`, `getHealth()`

**Resiliencia:** retry com backoff, timeout por tool, isolamento de erros por servidor

<!-- APPEND:integracoes -->


---

## Webhooks Recebidos

> Quais webhooks de servicos externos o sistema recebe?

| Servico | Evento | Endpoint Local | Acao | Validacao |
| --- | --- | --- | --- | --- |
| Nao aplicavel | — | — | O pacote nao expoe webhooks HTTP | — |

<!-- APPEND:webhooks -->

---

## Webhooks Enviados

> O sistema envia webhooks para parceiros/integradores?

| Evento | Destino | Payload | Retry | Assinatura |
| --- | --- | --- | --- | --- |
| `AgentEvent` | `hooks.onEvent` do consumidor | evento serializavel | controlado pelo consumidor | controlado pelo consumidor |

<!-- APPEND:webhooks-enviados -->

---

## Health Checks de Integracoes

> Como verificar se as integracoes estao funcionando?

| Servico | Endpoint de Health | Frequencia | Acao se falhar |
| --- | --- | --- | --- |
| SQLite local | `SELECT 1` / write-read basico | na inicializacao e sob erro | falhar rapido |
| OpenRouter API | chamada real ou smoke embedding | sob demanda | retry/backoff/alerta |
| MCP Server | heartbeat configuravel | intervalo configurado | `reconnecting` + remocao das tools |

> (ver [14-tests.md](14-tests.md) para estrategia de testes)
