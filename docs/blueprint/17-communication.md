# Comunicação

> **Status: N/A para este projeto.**

O Pure Agent é uma biblioteca TypeScript standalone. Não envia comunicações diretas a usuários finais (email, SMS, WhatsApp). A responsabilidade de comunicação com usuários finais é da aplicação host que consome o pacote.

---

## Comunicação do Agent (Eventos)

A única forma de "comunicação" do Pure Agent é via **AgentEvents** entregues ao consumidor:

| Canal | Mecanismo | Consumidor | Formato |
| ----- | --------- | ---------- | ------- |
| Streaming de eventos | `AsyncIterableIterator<AgentEvent>` | Aplicação host via `agent.stream()` | TypeScript objects (AgentEvent) |
| Custo acumulado | `agent.getUsage()` | Aplicação host (polling) | `TokenUsage` object |
| Saúde MCP | `agent.getHealth()` | Aplicação host (health check) | `{ servers: MCPHealthStatus[] }` |

---

## Responsabilidade do Consumidor

Se a aplicação host precisa enviar comunicações a usuários finais com base nas respostas do Agent:

- **Email/SMS/WhatsApp:** Implementar via `hooks.onEvent` ou pós-processamento do resultado de `chat()`/`stream()`
- **Notificações push:** Idem — consumidor decide quando e como notificar
- **Webhooks:** Consumidor expõe endpoints próprios se necessário

O Pure Agent não opina sobre canais de comunicação externa.
