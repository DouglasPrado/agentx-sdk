# Estrategia de Testes

Define a piramide de testes, ferramentas, cobertura minima e cenarios obrigatorios para o backend.

---

## Piramide de Testes

> Qual proporcao de testes por tipo?

<!-- do blueprint: 12-testing_strategy.md -->
| Tipo | Proporcao | Objetivo | Velocidade |
| --- | --- | --- | --- |
| Unitario | 70% | Logica pura de dominio, core e utils | < 1s por teste |
| Integracao | 20% | SQLite real `:memory:` e interacao entre subsistemas | < 5s por teste |
| E2E | 10% | Fluxos completos com OpenRouter real | < 30s por teste |

---

## Ferramentas

> Quais ferramentas sao usadas para cada tipo de teste?

| Tipo | Ferramenta | Funcao |
| --- | --- | --- |
| Framework | Vitest | runner, assertions e mocks |
| Integracao | SQLite `:memory:` | persistencia real sem container |
| Carga | Vitest bench ou script TS com `performance.now()` | benchmark interno |
| E2E | Vitest + API key via `AgentConfig` | cenarios reais do agente |
| Mocking | Vitest mocks | isolar OpenRouter, MCP e hooks |
| Cobertura | c8 / cobertura nativa do Vitest | thresholds de cobertura |

---

## Cobertura Minima

> Quais sao os thresholds de cobertura?

| Escopo | Cobertura Minima | Justificativa |
| --- | --- | --- |
| Geral | 80% | baseline do pacote |
| Core e dominio | 90% | logica critica de execucao e estados |
| Services/managers | 90% | orquestracao principal |
| Facades publicas | 70% | delegam ao core |
| Fluxos criticos | 100% | chat/stream, memory, knowledge, MCP e cost guard |

---

## Cenarios Obrigatorios

> Quais cenarios DEVEM ter teste antes de ir para producao?

| Cenario | Tipo | Prioridade |
| --- | --- | --- |
| Happy path de `chat()` e `stream()` | E2E | Must |
| Validacao de `AgentConfig`, `ChatOptions` e args de tools | Unitario | Must |
| Invariantes de memory, chat message e execution state | Unitario | Must |
| Transicoes das maquinas de estado | Unitario | Must |
| FTS5 search e vector search com SQLite real | Integracao | Must |
| Mutex por thread e concorrencia entre threads | Integracao | Must |
| OpenRouter timeout/retry | Integracao | Should |
| MCP reconnect e isolamento de falhas | Integracao | Should |
| Cost guard e max iterations | Integracao | Must |
| Performance de busca vetorial e StreamEmitter | Carga | Should |

<!-- APPEND:cenarios -->

---

## Organizacao de Testes

> Como os testes sao organizados no filesystem?

```
tests/
├── unit/
│   ├── core/
│   │   ├── react-loop.test.ts
│   │   ├── context-builder.test.ts
│   │   └── stream-emitter.test.ts
│   ├── domain/
│   │   ├── memory.test.ts
│   │   └── chat-message.test.ts
│   └── utils/
│       ├── token-counter.test.ts
│       └── cache.test.ts
├── integration/
│   ├── storage/
│   │   ├── sqlite-memory-store.test.ts
│   │   └── sqlite-vector-store.test.ts
│   ├── core/
│   │   └── conversation-manager.test.ts
│   └── tools/
│       └── mcp-adapter.test.ts
└── e2e/
    ├── chat.e2e.test.ts
    ├── knowledge.e2e.test.ts
    └── tool-calling.e2e.test.ts
```

---

## Ambientes de Teste

> Quais ambientes sao usados para testes?

| Ambiente | Banco | Cache | Filas | Servicos Externos |
| --- | --- | --- | --- | --- |
| Unit | Mock | Mock | In-process | Mock |
| Integration | SQLite `:memory:` | cache real em memoria | In-process | Mock |
| E2E | SQLite `:memory:` | cache real em memoria | In-process | OpenRouter real |
| Load | SQLite `:memory:` ou fixture local | cache real em memoria | In-process | Mock |

---

## CI Pipeline de Testes

> Quando cada tipo de teste roda no CI?

| Etapa | Trigger | Testes | Timeout | Bloqueia Merge |
| --- | --- | --- | --- | --- |
| Pre-commit | local | lint + unit rapidos | 2 min | Sim |
| PR Check | pull request | `tsc --noEmit` + unit + integration | 5 min | Sim |
| Merge to main | merge | unit + integration + build | 10 min | Sim |
| Nightly | cron | E2E com OpenRouter + benchmarks | 30 min | Nao |

<!-- APPEND:ci -->
