# Estratégia de Testes

> Defina como o sistema será testado em cada camada para garantir qualidade e confiança nas entregas.

---

## Pirâmide de Testes

Proporção: **70% unitários, 20% integração, 10% E2E (cenários manuais + script)**

```
        /  E2E (10%)  \
       /   Cenários    \
      /   com LLM real  \
     /--------------------\
    /  Integração (20%)    \
   /  SQLite + subsistemas  \
  /--------------------------\
 /     Unitários (70%)        \
/  Lógica pura, sem I/O       \
/________________________________\
```

> Nota: Como biblioteca sem API HTTP, "E2E" significa cenários end-to-end que instanciam Agent completo com LLM real (OpenRouter). São mais lentos e custam tokens.

---

## Categorias de Teste

### Unit Tests

| Item | Descrição |
|---|---|
| **Objetivo** | Validar lógica pura de cada módulo isoladamente, sem I/O externo (sem SQLite, sem OpenRouter, sem MCP). |
| **Escopo — O que testar** | TokenCounter (estimativa i18n), Cache LRU (eviction, TTL), Retry (backoff), Chunking (fixed/recursive), config validation (Zod), ContextBuilder (budget, compactação), StreamEmitter (backpressure, bounded queue), CostPolicy (limites), tool validation (Zod→JSON Schema), SkillManager matching (prefix, priority, desempate), Memory decay/confidence math. |
| **Ferramentas sugeridas** | Vitest (fast, TypeScript-native, compatible with Node 18+) |
| **Critérios de sucesso** | Cobertura ≥ 80% em módulos de lógica pura; todos passam no CI; tempo total < 30s. |

---

### Integration Tests

| Item | Descrição |
|---|---|
| **Objetivo** | Validar interação entre componentes internos com SQLite real (`:memory:`), sem chamar OpenRouter. |
| **Escopo — O que testar** | SQLiteDatabase (auto-create, migrations, WAL), SQLiteMemoryStore (save + FTS5 search + embeddings), SQLiteVectorStore (upsert + cosine search), ConversationManager (thread isolation, mutex, persist/load), MemoryManager (extração com LLM mockado, decay, consolidação), KnowledgeManager (ingest + search com embeddings mockados), ContextPipeline (5 stages com subsistemas reais mas LLM mockado), ReactLoop (fluxo completo com OpenRouterClient mockado). |
| **Ferramentas sugeridas** | Vitest, SQLite `:memory:` (sem container, sem setup externo) |
| **Critérios de sucesso** | FTS5 retorna resultados corretos; threads isoladas; mutex serializa; cost guard funciona; tempo total < 60s. |

---

### End-to-End Tests (Cenários com LLM)

| Item | Descrição |
|---|---|
| **Objetivo** | Validar fluxos completos do Agent com OpenRouter real — chat, tools, memory, knowledge, streaming. |
| **Escopo — O que testar** | Os 7 cenários do PRD: chat simples, tool calling, multimodal, structured output, threads isoladas, model override, knowledge RAG. |
| **Ferramentas sugeridas** | Vitest + API key passada via `AgentConfig.apiKey`; `deterministic: true` para reprodutibilidade. |
| **Critérios de sucesso** | Todos os 7 cenários do PRD passam; tempo total < 2min (depende do LLM); custo < $0.50 por execução completa. |

> E2E tests rodam apenas com flag `--e2e` ou em CI com API key configurada. Não rodam no `vitest` padrão.

---

### Load / Performance Tests

| Item | Descrição |
|---|---|
| **Objetivo** | Verificar performance de subsistemas internos sob carga (sem LLM real). |
| **Escopo — O que testar** | SQLiteVectorStore: busca vetorial com 10K/50K/100K vetores; SQLiteMemoryStore: FTS5 search com 10K memórias; StreamEmitter: throughput de eventos com backpressure; ConversationManager: 100 threads concorrentes. |
| **Ferramentas sugeridas** | Vitest bench (benchmarks nativos) ou script TypeScript com `performance.now()` |
| **Critérios de sucesso** | Busca vetorial 50K < 100ms; FTS5 < 10ms; 100 threads concorrentes sem deadlock; StreamEmitter > 10K events/s. |

---

### Resilience Tests

| Item | Descrição |
|---|---|
| **Objetivo** | Validar comportamento do sistema quando dependências externas falham. |
| **Escopo — O que testar** | OpenRouter retorna 429/500/timeout → retry com backoff; MCP server desconecta → reconexão automática; Tool lança exceção → error recovery (continue/stop/retry); SQLite arquivo locked → comportamento com WAL; AbortSignal durante execução → cleanup correto. |
| **Ferramentas sugeridas** | Vitest com mocks que simulam falhas (timeouts, erros HTTP, exceções) |
| **Critérios de sucesso** | Retry funciona corretamente; MCP reconecta em < 10s; tools com erro não corrompem estado; abort cancela limpo. |

---

## Cobertura Mínima

| Camada | Cobertura Mínima | Justificativa |
|---|---|---|
| Unit Tests | 80% (lógica pura) | Protege contra regressões em cálculos de tokens, decay, budget, validação, cache |
| Integration Tests | 100% dos subsistemas | Cada subsistema (memory, knowledge, tools, conversation, context) deve ter pelo menos 1 test suite |
| E2E Tests | 100% dos 7 cenários do PRD | Validação completa das features prometidas — contrato com o consumidor |
| Load Tests | Endpoints críticos (busca vetorial, FTS5, streaming) | Previne degradação nos pontos de maior uso |
| Resilience Tests | Cenários de falha mapeados nos fluxos críticos | Valida error recovery — diferencial de qualidade do pacote |

<!-- APPEND:coverage -->

---

## Ambientes de Teste

| Ambiente | Propósito | Dados |
|---|---|---|
| Local (dev) | Desenvolvimento e testes unitários/integração rápidos | SQLite `:memory:`, mocks de LLM, fixtures locais |
| CI (GitHub Actions) | Execução automatizada de unit + integration + build | SQLite `:memory:`, mocks de LLM, sem API key |
| CI com E2E | Execução de cenários E2E com LLM real | SQLite `:memory:`, OpenRouter API key em secret, `deterministic: true` |

---

## Automação e CI

| Etapa do Pipeline | Testes Executados | Gatilho | Bloqueante? |
|---|---|---|---|
| Pull Request | `tsc --noEmit` + Unit + Integration | Push / abertura de PR | Sim |
| Merge na main | Unit + Integration + Build | Merge | Sim |
| Nightly (agendado) | E2E com LLM real + Load benchmarks | Cron (diário) | Não (notificação) |
| Release tag | Unit + Integration + E2E + verificação de 0 imports externos | Tag semver | Sim |

<!-- APPEND:ci-pipeline -->

> Tempo máximo aceitável para pipeline de PR: < 2 min (sem E2E). Pipeline nightly com E2E: < 5 min.
