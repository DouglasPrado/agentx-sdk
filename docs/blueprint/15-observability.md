# Observabilidade

> Se você não consegue observar, você não consegue operar. Defina como o sistema será monitorado.

> **Nota:** O Pure Agent é uma biblioteca. Observabilidade é fornecida via `AgentEvents` com `traceId` e `AgentHooks.onEvent`. A aplicação host decide como consumir, agregar e visualizar essas informações.

---

## Logs

### Formato

Logger embutido (console-based) com output estruturado. Consumidor pode integrar via `hooks.onEvent`:

```json
{
  "timestamp": "2026-04-01T12:00:00.000Z",
  "level": "INFO",
  "service": "pure-agent",
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "threadId": "default",
  "type": "tool_call_end",
  "data": {
    "tool": "get_weather",
    "duration": 250,
    "isError": false
  }
}
```

### Níveis de Log

| Nível | Quando usar |
|-------|-------------|
| DEBUG | Detalhes de SSE parsing, token counting, cache hits/misses, context budget calculations |
| INFO | Eventos normais: agent_start, turn_start/end, tool_call_start/end, agent_end |
| WARN | Situações não-fatais: context truncated (finish_reason: length), cost warning, FTS5 degraded, vectorstore >50K |
| ERROR | Falhas recuperáveis: tool execution error, MCP reconnection, memory extraction failed |
| FATAL | Falhas irrecuperáveis: SQLite initialization failed, invalid config (Zod validation) |

### Retenção

| Ambiente | Tempo de retenção |
|----------|-------------------|
| Produção | Responsabilidade do consumidor (recomendado: 30 dias) |
| CI/Testing | Duração do job (descartado após) |
| Dev local | Sessão do processo (console output) |

### Eventos Críticos (sempre logados)

- `agent_end` com `reason: 'cost_limit'` — orçamento esgotado
- `error` events — qualquer erro no ReactLoop
- `tool_call_end` com `isError: true` — falha de tool
- MCP server disconnected / reconnecting
- Memory extraction falhou
- Context compaction triggered (histórico excedeu budget)

---

## Métricas

### Golden Signals (via AgentEvents)

| Métrica | Descrição | Threshold de Alerta |
|---------|-----------|---------------------|
| Latência | `agent_end.duration` — tempo total da execução (ms) | > 30s (excluindo latência LLM esperada) |
| Tráfego | Contagem de `agent_start` events por minuto | N/A (definido pelo consumidor) |
| Erros | Taxa de `error` events / total de `agent_start` | > 5% |
| Saturação | `agent_end.usage.totalTokens` / `costPolicy.maxTokensPerSession` | > 80% do budget |

### Métricas Custom do Pure Agent

| Métrica | Descrição | Threshold de Alerta |
|---------|-----------|---------------------|
| tokens_per_execution | Tokens consumidos por chamada chat/stream | > maxTokensPerExecution × 0.8 |
| tool_calls_per_execution | Número de tool calls por execução | > maxToolCallsPerExecution × 0.8 |
| tool_error_rate | % de tool_call_end com isError:true | > 20% |
| memory_extraction_rate | % de turnos com extração de memória | Desvio > 2x do extractionRate configurado |
| vector_search_latency | Tempo de busca vetorial (ms) | > 200ms (indica >100K vetores) |
| fts5_search_latency | Tempo de busca FTS5 (ms) | > 50ms |
| cache_hit_rate | % de hits no cache LRU de embeddings | < 30% (cache ineficiente) |
| mcp_reconnection_count | Reconexões MCP por hora | > 5 (server instável) |
| context_compaction_count | Compactações de histórico por sessão | > 10 (conversas muito longas) |

<!-- APPEND:metrics -->

### Indicadores de Saúde

- `agent_end` events sem `error` → sistema operando normalmente
- `cache_hit_rate` > 60% → cache funcionando eficientemente
- `tool_error_rate` < 5% → tools estáveis
- MCP status: `connected` para todos os servers configurados

---

## Tracing

O Pure Agent fornece tracing embutido via `ExecutionContext`:

- **Ferramenta:** Embutida (ExecutionContext com traceId). Consumidor integra com OpenTelemetry, Datadog, etc. via `hooks.onEvent`
- **Protocolo de propagação:** traceId (UUID v4) incluído em todos os AgentEvents
- **Taxa de amostragem:** 100% (todos os eventos incluem traceId). Consumidor pode aplicar sampling no destino

### Convenções de Spans

| Campo | Valor |
|-------|-------|
| traceId | UUID v4 único por execução chat()/stream() |
| threadId | String identificando a thread de conversa |
| parentTraceId | UUID do trace pai (para sub-execuções como memory extraction) |
| type | Tipo do evento (agent_start, tool_call_start, etc.) |
| duration | Tempo em ms (disponível em tool_call_end, agent_end) |
| model | Modelo LLM usado nesta execução |

### Exemplo de Integração com OpenTelemetry

```typescript
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('pure-agent');

agent.stream("Hello", {
  hooks: {
    onEvent: (event) => {
      if (event.type === 'agent_start') {
        tracer.startSpan('agent.execution', { attributes: { traceId: event.traceId } });
      }
      if (event.type === 'tool_call_start') {
        tracer.startSpan(`tool.${event.tool}`, { attributes: { args: JSON.stringify(event.args) } });
      }
    }
  }
});
```

---

## Alertas

| Alerta | Severidade | Condição | Ação |
|--------|------------|----------|------|
| Cost limit atingido | P2 | `agent_end` com `reason: 'cost_limit'` | Verificar se execução legítima; ajustar maxTokensPerExecution se necessário |
| Taxa de erro alta | P2 | > 5% de execuções com `error` event em 5min | Verificar OpenRouter status; checar logs de erro |
| MCP server desconectado | P3 | MCP status `error` ou `reconnecting` por > 5min | Verificar processo MCP; reiniciar se necessário |
| Busca vetorial lenta | P3 | vector_search_latency > 200ms | Verificar volume de vetores; considerar migração para VectorStore externo |
| Session budget exhausted | P2 | maxTokensPerSession atingido | Criar nova instância do Agent; investigar consumo |
| Tool errors consecutivos | P3 | maxConsecutiveErrors atingido | Verificar tool específica; checar args e dependências |
| SQLite file locked | P1 | SQLiteDatabase falha ao inicializar | Verificar se outro processo está usando o mesmo arquivo |

<!-- APPEND:alerts -->

### Severidades

| Severidade | Significado | Tempo de resposta |
|------------|-------------|-------------------|
| P1 | Agent não funciona (SQLite locked, config inválida) | Imediato |
| P2 | Funcionalidade crítica degradada (cost limit, alta taxa de erros) | < 1 hora |
| P3 | Funcionalidade secundária impactada (MCP down, busca lenta) | < 4 horas |
| P4 | Problema menor (cache hit rate baixo, warnings) | Próximo dia útil |

> Como biblioteca, alertas são responsabilidade do consumidor. O Agent fornece os dados via eventos.

### Política de Escalação

| Etapa | Tempo após disparo | Responsável | Canal |
|-------|---------------------|-------------|-------|
| 1 | Imediato | Consumidor (hooks.onEvent) | Log/console |
| 2 | Configurável | Aplicação host (integração com alerting) | Slack/PagerDuty/etc |
| 3 | Configurável | Equipe de operações | Conforme runbook do consumidor |

---

## Dashboards

| Nome | Público-alvo | Métricas incluídas |
|------|-------------|-------------------|
| Agent Operations | Desenvolvedor/SRE | tokens_per_execution, tool_error_rate, latência, erros, MCP status, cache_hit_rate |
| Cost Monitoring | Produto/Gestão | tokens acumulados por sessão, custo estimado (tokens × pricing), execuções por período |
| Memory & Knowledge | Desenvolvedor | memórias ativas, confidence distribution, vetores total, busca latência, extraction rate |

<!-- APPEND:dashboards -->

---

## Health Checks

O Pure Agent não expõe endpoints HTTP. O consumidor pode implementar health checks usando a API do Agent:

### Verificação de Saúde

```typescript
function checkHealth(agent: Agent) {
  const health = agent.getHealth();
  // { servers: [{ name: "whatsapp", status: "connected", toolCount: 5, ... }] }

  return {
    status: "healthy",
    checks: {
      agent: "ready", // Agent instanciado e operacional
      usage: agent.getUsage(), // Tokens consumidos na sessão
      mcp: health ?? "not_configured"
    }
  };
}
```

### O que verificar

- **Agent operacional:** `agent.getUsage()` não lança erro
- **SQLite acessível:** Operações de read/write funcionam
- **MCP servers:** `agent.getHealth()` retorna status `connected` para todos (retorna `{ servers: [...] }`)
- **Cost budget:** `usage.totalTokens < maxTokensPerSession`
