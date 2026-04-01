# {{Nome do Projeto}}

## Fonte de Verdade

Todo codigo DEVE implementar fielmente o que esta documentado nos blueprints.
Localizacao dos blueprints: {{caminho relativo dos docs}}

**Regras inviolaveis:**
- NUNCA gere codigo sem antes ler os docs de blueprint relevantes para a tarefa
- Use a linguagem ubiqua do dominio (nomes de entidades, campos, acoes)
- Sempre leia `src/contracts/` antes de implementar qualquer feature
- Test-first: escreva testes ANTES da implementacao (XP)

---

## Stack Tecnologica

{{Extraido de docs/blueprint/06-system-architecture.md}}

| Camada | Tecnologia | Versao |
|--------|-----------|--------|
| {{Backend}} | {{Framework}} | {{Versao}} |
| {{Frontend}} | {{Framework}} | {{Versao}} |
| {{Banco de Dados}} | {{Tecnologia}} | {{Versao}} |
| {{ORM}} | {{Tecnologia}} | {{Versao}} |
| {{Cache}} | {{Tecnologia}} | {{Versao}} |
| {{Mensageria}} | {{Tecnologia}} | {{Versao}} |

---

## Mapa de Contexto por Tarefa

Antes de iniciar qualquer tarefa, leia os docs listados abaixo conforme o tipo de trabalho.

### Schema / Migrations
- docs/blueprint/04-domain-model.md (entidades, regras de negocio)
- docs/blueprint/05-data-model.md (tabelas, indices, constraints)
- docs/blueprint/09-state-models.md (maquinas de estado)

### API / Backend
- docs/blueprint/07-critical_flows.md (fluxos, tratamento de erros)
- docs/blueprint/08-use_cases.md (atores, pre/pos condicoes)
- docs/blueprint/06-system-architecture.md (componentes, comunicacao)

### Frontend Components
- docs/frontend/04-componentes.md (hierarquia de componentes)
- docs/frontend/05-estado.md (state management)
- docs/frontend/06-data-layer.md (data fetching, cache)

### Routing / Navigation
- docs/frontend/07-rotas.md (rotas, guards, middlewares)
- docs/frontend/08-fluxos.md (fluxos de interface)

### Security
- docs/blueprint/13-security.md (threat model, autenticacao, autorizacao)
- docs/frontend/11-seguranca.md (XSS, CSRF, CSP)

### Testing
- docs/blueprint/12-testing_strategy.md (piramide de testes, coverage)
- docs/frontend/09-testes.md (testes de frontend)

### Observabilidade
- docs/blueprint/15-observability.md (logging, metricas, tracing)
- docs/frontend/12-observabilidade.md (frontend monitoring)

---

## Convencoes de Codigo

### Nomenclatura
- Entidades: PascalCase (conforme glossario do dominio)
- Campos/propriedades: camelCase
- Rotas API: {{padrao extraido da arquitetura — ex: /api/v1/resource}}
- Arquivos de componentes: {{padrao — ex: PascalCase.tsx}}
- Arquivos de servicos: {{padrao — ex: kebab-case.service.ts}}

### Principios Arquiteturais
{{Extraido de docs/blueprint/02-architecture_principles.md}}

1. {{Principio 1}} — {{implicacao pratica}}
2. {{Principio 2}} — {{implicacao pratica}}
3. {{Principio 3}} — {{implicacao pratica}}

### Glossario do Dominio (Linguagem Ubiqua)

{{Extraido de docs/blueprint/04-domain-model.md — secao de glossario}}

| Termo | Significado | Uso no Codigo |
|-------|-----------|---------------|
| {{Termo}} | {{Definicao}} | {{Como aparece no codigo: nome de classe, tabela, etc.}} |

---

## Sempre Ler Antes de Codar

- `src/contracts/` — tipos compartilhados e interfaces
- `{{arquivo de schema — ex: prisma/schema.prisma}}` — schema do banco de dados
- `package.json` — dependencias instaladas

---

## Workflow de Desenvolvimento (XP)

```
1. Leia os docs do blueprint relevantes para a feature
2. Leia src/contracts/ para tipos existentes
3. RED:      Escreva os testes primeiro
4. GREEN:    Implemente o minimo para os testes passarem
5. REFACTOR: Melhore o codigo mantendo testes verdes
6. Commit small release
```

---

## Skills de Codegen Disponiveis

| Skill | Uso | Quando |
|-------|-----|--------|
| `/codegen` | Apresenta entregas do build plan | Inicio de sessao |
| `/codegen-contracts` | Gera tipos, schema, scaffold | Setup inicial (uma vez) |
| `/codegen-feature` | Implementa feature (TDD) | Dia-a-dia |
| `/codegen-verify` | Verifica codigo vs blueprint | A cada 3-5 features |
| `/codegen-claudemd` | Gera/atualiza este arquivo | Setup inicial |

---

## Context Excerpting

Para docs grandes (50k+ tokens), NAO carregue o doc inteiro. Em vez disso:

1. Leia o indice/sumario do doc (headers)
2. Use Grep para encontrar secoes relevantes a feature
3. Carregue apenas as secoes necessarias

Isso mantem cada sessao dentro do budget de ~70-100k tokens de contexto.
