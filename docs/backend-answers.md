# Backend Answers

## Decisoes Confirmadas

- Stack principal: TypeScript em Node.js 18+, sem framework HTTP, com `fetch()` nativo, `zod`, `better-sqlite3` e `zod-to-json-schema`
- Padrao de implementacao: biblioteca standalone in-process, com API publica TypeScript e interfaces plugaveis
- Persistencia padrao: SQLite com SQL direto via `better-sqlite3`, prepared statements, WAL mode e migrations em codigo
- ORM: nao utilizar ORM; repositories/stores encapsulam SQL e mapeamento
- Deploy: sem deploy proprio; distribuicao como pacote consumido pela aplicacao host
- CI/CD: `tsc --noEmit`, testes unitarios e integracao por padrao; E2E com OpenRouter apenas quando houver credenciais
- API contracts: adaptar templates HTTP para contratos programaticos da API publica (`Agent`, managers, stores e hooks)
- Controllers: adaptar para facades/entrypoints programaticos
- Middlewares: adaptar para pipeline de execucao, contexto, budget, tracing e hooks
- Auth/permissions: nao ha JWT/RBAC de usuarios finais; seguranca baseada em boundaries de capability, validacao de tools e isolamento
- Async/mensageria: eventos in-process e AsyncIterator como padrao; sem broker externo por default
- Integracoes externas: OpenRouter API, servidores MCP e filesystem/SQLite local

## Rastreabilidade

- Stack e restricoes: `docs/blueprint/00-context.md`, `docs/blueprint/02-architecture_principles.md`, `docs/blueprint/10-architecture_decisions.md`
- Persistencia e queries: `docs/blueprint/05-data-model.md`
- Componentes e deploy: `docs/blueprint/06-system-architecture.md`
- Fluxos e erro recovery: `docs/blueprint/07-critical_flows.md`
- Casos de uso da API publica: `docs/blueprint/08-use_cases.md`
- Estados: `docs/blueprint/09-state-models.md`
- Seguranca: `docs/blueprint/13-security.md`
- Escalabilidade e cache: `docs/blueprint/14-scalability.md`
- Observabilidade: `docs/blueprint/15-observability.md`
- Testes: `docs/blueprint/12-testing_strategy.md`
