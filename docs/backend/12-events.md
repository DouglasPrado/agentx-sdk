# Eventos e Mensageria

Define eventos de dominio, filas, workers assincronos, schemas de payload e estrategias de retry.

---

## Estrategia de Mensageria

> Qual tecnologia e padrao de mensageria o sistema usa?

<!-- do blueprint: 02-architecture_principles.md, 06-system-architecture.md, 17-communication.md -->
| Aspecto | Decisao |
| --- | --- |
| Message Broker | Nenhum por padrao |
| Padrao | Eventos in-process + streaming via `AsyncIterableIterator` |
| Storage | Memoria da execucao; persistencia indireta em SQLite quando aplicavel |
| Formato | Objetos TypeScript serializaveis em JSON |
| Idempotencia | `traceId` + `eventId`/dedup por origem |

---

## Mapa de Eventos

> Quais eventos existem, quem produz e quem consome?

| Evento | Produtor | Consumidor(es) | Fila/Topico | Retry | DLQ |
| --- | --- | --- | --- | --- | --- |
| `AgentStarted` | AgentRuntimeService | host app, logger hooks | in-process | nao | nao |
| `TextDelta` | ReactLoop | host app | in-process stream | nao | nao |
| `ToolCallStarted` | ToolExecutor | host app, observabilidade | in-process | nao | nao |
| `ToolCallEnded` | ToolExecutor | host app, observabilidade | in-process | nao | nao |
| `MemoryExtracted` | MemoryService | host app, memory store | in-process | melhor esforco | nao |
| `MCPDisconnected` | MCPService | host app, observabilidade | in-process | sim, reconexao | nao |
| `AgentEnded` | AgentRuntimeService | host app | in-process | nao | nao |

<!-- APPEND:eventos -->

---

## Schema de Eventos

> Para CADA evento, documente payload, versao e regra de idempotencia.

### AgentEnded

```json
{
  "eventId": "uuid-v4",
  "type": "AgentEnded",
  "version": "1.0",
  "timestamp": "2026-04-01T00:00:00.000Z",
  "source": "agent-runtime-service",
  "payload": {
    "traceId": "uuid-v4",
    "threadId": "default",
    "usage": { "inputTokens": 10, "outputTokens": 20, "totalTokens": 30 },
    "reason": "completed",
    "duration": 420
  }
}
```

**Idempotencia:** por `eventId`; consumers externos podem deduplicar por `traceId + type + timestamp`

<!-- APPEND:schemas -->


---

## Workers Assincronos

> Quais workers processam filas? Documente concorrencia, timeout e retry.

| Worker | Fila | Funcao | Concorrencia | Timeout | Retry | DLQ |
| --- | --- | --- | --- | --- | --- | --- |
| `MemoryExtractionTask` | in-process | extrair memorias apos turno | 1 por thread | < 3s | nao bloqueante | nao |
| `MCPReconnectTask` | in-process timer | reconectar servidor MCP | por conexao | < 10s total | backoff exponencial | nao |
| `ContextCompactionTask` | in-process | compactar historico via LLM | 1 por execucao | configuravel | fallback para truncamento | nao |

<!-- APPEND:workers -->

---

## Estrategia de Retry

> Como retries sao configurados?

| Estrategia | Descricao | Quando Usar |
| --- | --- | --- |
| Backoff exponencial | 1s, 2s, 4s... | OpenRouter e MCP |
| Retry unico | 1 tentativa adicional | `onToolError=retry` |
| Sem retry | falha imediata | validacao de schema e regras de negocio |

**Nota:** Este pacote nao possui DLQ. Eventos nao entregues sao perdidos (in-process). O consumidor pode implementar persistencia via `hooks.onEvent`.

---

## Cron Jobs / Scheduled Tasks

> Existem tarefas agendadas?

| Job | Frequencia | Funcao | Timeout | Observacao |
| --- | --- | --- | --- | --- |
| `ApplyMemoryDecay` | a cada N turnos | reduz confidence de memorias ociosas | < 50ms | disparado pelo proprio fluxo |
| `ConsolidateMemories` | periodico/configuravel | dedup semantica | batch | pode ficar para versoes futuras |
| `MCPHeartbeat` | intervalo configurado | health check de conexoes MCP | timeout individual | remove tools em caso de falha |

<!-- APPEND:cron -->

> (ver [13-integrations.md](13-integrations.md) para detalhes dos clients externos)
