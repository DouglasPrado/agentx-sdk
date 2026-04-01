# Indice Mestre de Rastreabilidade

> Mapa completo mostrando como informacao flui do PRD para implementacao. Use para rastrear qualquer decisao ate sua origem.

---

## Fluxo de Dados

```
PRD (docs/prd.md)
  │
  ▼
Blueprint Tecnico (docs/blueprint/)     ← FONTE PRIMARIA
  │
  ├──► Backend (docs/backend/)          ← Implementacao server
  ├──► Frontend (docs/frontend/)        ← Implementacao client
  ├──► Business (docs/business/)        ← Modelo de negocio
  └──► Shared (docs/shared/)            ← Conectores cross-suite
         ├── glossary.md                ← Termos unicos
         ├── event-mapping.md           ← Backend eventos → Frontend estado
         ├── error-ux-mapping.md        ← Backend erros → Frontend UX
         └── MAPPING.md                 ← Este arquivo
```

---

## Mapeamento Blueprint → Backend

| Blueprint | Backend | O que flui |
| --- | --- | --- |
| 00-context.md | 13-integrations.md | Sistemas externos → clients de API |
| 01-vision.md | 00-backend-vision.md | Metricas, nao-objetivos |
| 02-architecture_principles.md | 00-backend-vision.md | Principios de design |
| 03-requirements.md | 05-api-contracts.md, 10-validation.md | RF → endpoints; RNF → metricas |
| 04-domain-model.md | 03-domain.md, 10-validation.md | Entidades → classes; Regras → validacoes |
| 05-data-model.md | 04-data-layer.md | Tabelas → repositories; Queries → indices |
| 06-system-architecture.md | 01-architecture.md, 08-middlewares.md | Componentes → camadas; Deploy → infra |
| 07-critical_flows.md | 06-services.md, 09-errors.md | Fluxos → metodos de service; Erros → catalogo |
| 08-use_cases.md | 05-api-contracts.md, 11-permissions.md | UCs → endpoints; Atores → RBAC |
| 09-state-models.md | 03-domain.md | Estados → maquinas de estado nas entidades |
| 10-architecture_decisions.md | 00-backend-vision.md, 01-architecture.md | ADRs → justificativas de stack |
| 11-build_plan.md | — | Ordem de implementacao |
| 12-testing_strategy.md | 14-tests.md | Piramide → ferramentas e cenarios |
| 13-security.md | 08-middlewares.md, 11-permissions.md | Auth → middleware; RBAC → matriz |
| 14-scalability.md | 08-middlewares.md | Cache, rate limit → config de middleware |
| 15-observability.md | 08-middlewares.md | Logs, traces → pipeline de request |
| 16-evolution.md | 05-api-contracts.md | Versionamento API |
| 17-communication.md | 12-events.md, 13-integrations.md | Canais → workers; Provedores → clients |

---

## Mapeamento Blueprint → Frontend

| Blueprint | Frontend | O que flui |
| --- | --- | --- |
| 00-context.md | 00-frontend-vision.md | Atores → personas do frontend |
| 01-vision.md | 00-frontend-vision.md | Problema → contexto do frontend |
| 02-architecture_principles.md | 01-architecture.md | Principios → camadas do frontend |
| 03-requirements.md | 09-tests.md, 10-performance.md | RNF → Core Web Vitals, cobertura |
| 04-domain-model.md | 03-design-system.md, 04-components.md | Entidades → componentes de UI |
| 05-data-model.md | 06-data-layer.md | Schema → DTOs e API client |
| 06-system-architecture.md | 01-architecture.md, 13-cicd-conventions.md | Deploy → CI/CD frontend |
| 07-critical_flows.md | 08-flows.md | Fluxos sistema → fluxos de UI |
| 08-use_cases.md | 07-routes.md, 04-components.md | UCs → telas/rotas |
| 09-state-models.md | 05-state.md | Estados → stores do frontend |
| 13-security.md | 11-security.md | Auth → protecao de rotas |
| 14-scalability.md | 10-performance.md | Cache → estrategia client-side |
| 15-observability.md | 12-observability.md | Metricas → error tracking frontend |
| 17-communication.md | 14-copies.md | Templates → copies e mensagens |
| backend/05-api-contracts.md | 15-api-dependencies.md | Endpoints → dependencias consumidas pelo frontend |

---

## Mapeamento Blueprint → Business

| Blueprint | Business | O que flui |
| --- | --- | --- |
| 00-context.md | 00-business-context.md | Atores → mercado, segmento |
| 01-vision.md | 01-value-proposition.md, 05-revenue-model.md | Problema → proposta de valor |
| 03-requirements.md | 05-revenue-model.md | Features → pricing tiers |
| 06-system-architecture.md | 06-cost-structure.md, 09-operational-plan.md | Infra → custos; Deploy → operacoes |
| 11-build_plan.md | 09-operational-plan.md | Fases → timeline operacional |
| 14-scalability.md | 06-cost-structure.md | Escala → projecao de custos |
| 15-observability.md | 07-metrics-kpis.md | Metricas tecnicas → KPIs de negocio |
| 17-communication.md | 03-channels-distribution.md, 04-relationships.md | Canais → distribuicao e relacionamento |

---

## Documentos Compartilhados (Cross-Suite)

| Documento | Conecta | Proposito |
| --- | --- | --- |
| `shared/glossary.md` | Todos | Termos unicos do dominio |
| `shared/event-mapping.md` | Backend 12 ↔ Frontend 05/06/08 | Eventos → estado e fluxos do frontend |
| `shared/error-ux-mapping.md` | Backend 09 ↔ Frontend 11/12 | Erros → resposta visual |
