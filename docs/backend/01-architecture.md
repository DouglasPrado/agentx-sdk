# Arquitetura do Backend

Define as camadas arquiteturais, regras de dependencia, fronteiras de dominio e estrategia de deploy.

> **Implementa:** [docs/blueprint/06-system-architecture.md](../blueprint/06-system-architecture.md) (componentes e deploy) e [docs/blueprint/10-architecture_decisions.md](../blueprint/10-architecture_decisions.md) (ADRs).
> **Complementa:** [docs/frontend/01-architecture.md](../frontend/01-architecture.md) (camadas do frontend).

---

## Camadas Arquiteturais

> Como o backend e organizado internamente? Quais sao as camadas e como se comunicam?

```
┌─────────────────────────────────────────┐
│           Presentation Layer            │
│   (Controllers, Routes, Middlewares)    │
├─────────────────────────────────────────┤
│           Application Layer             │
│     (Services, DTOs, Validators)        │
├─────────────────────────────────────────┤
│             Domain Layer                │
│  (Entities, Value Objects, Events)      │
├─────────────────────────────────────────┤
│         Infrastructure Layer            │
│ (Repositories, Cache, Queue, External)  │
└─────────────────────────────────────────┘
```

<!-- do blueprint: 06-system-architecture.md, 10-architecture_decisions.md -->
| Camada | Contem | Regra de Dependencia |
| --- | --- | --- |
| Public API | `agent.ts`, `index.ts`, tipos publicos e hooks | So depende de Core/Application |
| Core/Application | `react-loop`, `context-pipeline`, `conversation-manager`, `tool-executor`, managers | Depende de Domain e Ports |
| Domain | Entidades, estados, erros, eventos, interfaces de store | Nao depende de nenhuma implementacao externa |
| Infrastructure | SQLite stores, OpenRouter client, MCP adapter, logger, caches | Implementa portas do dominio/core |

<!-- APPEND:camadas -->

---

## Regras de Dependencia

> Quais regras garantem o isolamento entre camadas?

<!-- do blueprint: 02-architecture_principles.md -->
- A camada Domain nunca importa de Infrastructure ou Public API
- `Agent` e managers nao acessam SQL bruto fora dos stores/repositories dedicados
- Implementacoes concretas de SQLite e OpenRouter ficam atras de interfaces/ports
- `chat()` nao contem fluxo proprio: sempre consome `stream()` internamente
- Eventos sao o contrato de observabilidade; nenhum subsistema falha silenciosamente

---

## Fronteiras de Dominio

> Como o backend e dividido em modulos/dominios? Cada modulo encapsula uma area de negocio.

<!-- do blueprint: 04-domain-model.md, 06-system-architecture.md -->
| Modulo/Dominio | Responsabilidade | Entidades Principais | Depende de |
| --- | --- | --- | --- |
| Agent Runtime | Orquestrar uma execucao completa do agente | Agent, ExecutionContext, ReactLoopExecution | Tools, Context, Conversation |
| Conversation | Isolar threads e historico | ChatMessage, ThreadContext | Storage |
| Tools | Registrar, validar e executar tools locais e MCP | AgentTool, ToolCallExecution | OpenRouter schema, MCP |
| Memory | Extrair, persistir e recuperar memorias | Memory | Embeddings, SQLite |
| Knowledge | Ingerir documentos e fazer RAG | KnowledgeDocument, KnowledgeChunk | Embeddings, SQLite |
| Skills | Ativar comportamentos contextuais | AgentSkill | Embeddings opcional |
| MCP | Conectar ferramentas externas | MCPConnection | SDK MCP |

<!-- APPEND:dominios -->

---

## Comunicacao entre Modulos

> Como os modulos se comunicam? Chamada direta, eventos, ou ambos?

<!-- do blueprint: 06-system-architecture.md, 07-critical_flows.md -->
| De | Para | Tipo | Mecanismo | Exemplo |
| --- | --- | --- | --- | --- |
| Agent | ContextPipeline | Sincrono/async | Chamada de metodo | `Agent.stream()` monta contexto antes do loop |
| ReactLoop | OpenRouterClient | Async streaming | HTTPS + SSE | `streamChat()` entrega chunks e tool calls |
| ReactLoop | ToolExecutor | Async | Chamada de metodo | Executa tools em paralelo ou sequencial |
| ContextPipeline | KnowledgeManager | Async | Chamada de metodo | Busca RAG para injecao de contexto |
| ContextPipeline | MemoryManager | Async | Chamada de metodo | Recall de memorias relevantes |
| MCPAdapter | Servidor MCP | Async | stdio / SSE | `tools/list` e `tools/call` |
| StreamEmitter | Consumidor host | Async | `AsyncIterableIterator` | Entrega `AgentEvent` com backpressure |

<!-- APPEND:comunicacao -->

---

## Estrategia de Deploy

> Como o backend e implantado em cada ambiente?

<!-- do blueprint: 06-system-architecture.md, 12-testing_strategy.md -->
| Ambiente | Infraestrutura | Deploy | URL |
| --- | --- | --- | --- |
| Development | Projeto Node.js do consumidor + pacote local | Import local / link npm | N/A |
| CI/Test | Runner de CI com SQLite `:memory:` e mocks | Execucao automatizada de build/test | N/A |
| Production | Processo Node.js da aplicacao host | Publicacao/versionamento do pacote | N/A |

**Pipeline CI/CD:**

```
Push -> lint/typecheck -> unit -> integration -> build package -> optional E2E -> release/version bump
```

<!-- APPEND:deploy -->

> (ver [02-project-structure.md](02-project-structure.md) para a arvore de diretorios)
