# Estrutura do Projeto

Define a arvore de diretorios do backend, o proposito de cada pasta e as convencoes de organizacao de arquivos.

---

## Arvore de Diretorios

> Como o projeto e organizado no filesystem? Cada pasta tem um proposito claro.

```
src/
├── agent.ts               # Fachada publica principal
├── index.ts               # Re-exports publicos
├── config/
│   └── config.ts          # Schema Zod de AgentConfig e normalizacao
├── types/
│   ├── agent-types.ts     # AgentEvent, TokenUsage, ContentPart, ChatOptions
│   ├── tool-types.ts      # AgentTool, AgentToolResult
│   └── storage-types.ts   # Interfaces plugaveis de store
├── domain/
│   ├── entities/          # Agent, ChatMessage, Memory, KnowledgeDocument, ExecutionContext
│   ├── events/            # Eventos de dominio e factory helpers
│   ├── errors/            # Erros tipados do dominio/core
│   └── states/            # State machines e guard clauses
├── core/
│   ├── react-loop.ts      # Loop principal de execucao
│   ├── context-pipeline.ts # Stages de contexto
│   ├── context-builder.ts # Budget, compactacao e priorizacao
│   ├── conversation-manager.ts # Thread mutex e historico
│   ├── execution-context.ts # TraceId, timing e correlacao
│   └── stream-emitter.ts  # Canal async com bounded queue
├── memory/
│   ├── memory-manager.ts
│   ├── memory-store.ts
│   └── sqlite-memory-store.ts
├── knowledge/
│   ├── knowledge-manager.ts
│   ├── vector-store.ts
│   ├── sqlite-vector-store.ts
│   ├── embedding-service.ts
│   └── chunking.ts
├── tools/
│   ├── tool-executor.ts
│   └── mcp-adapter.ts
├── skills/
│   └── skill-manager.ts
├── llm/
│   ├── openrouter-client.ts
│   ├── message-types.ts
│   └── reasoning.ts
├── storage/
│   └── sqlite-database.ts
└── utils/
    ├── logger.ts
    ├── token-counter.ts
    ├── retry.ts
    └── cache.ts
```

<!-- APPEND:estrutura -->

---

## Convencoes de Nomenclatura

> Como arquivos e pastas sao nomeados?

| Tipo | Convencao | Exemplo |
| --- | --- | --- |
| Entidade | PascalCase singular | `Agent.ts`, `Memory.ts` |
| Manager/Service | kebab-case ou camelized por dominio | `memory-manager.ts`, `knowledge-manager.ts` |
| Store/Repository | kebab-case + `-store` ou `-repository` | `memory-store.ts`, `sqlite-memory-store.ts` |
| Tipos | kebab-case + `-types` | `tool-types.ts` |
| Teste | `*.test.ts` | `react-loop.test.ts` |
| Migration interna | `migrateV<number>()` em codigo | `migrateV1()` |
| Erro | PascalCase + `Error` | `CostLimitExceededError.ts` |
| Evento | PascalCase no passado | `MemoryExtracted`, `MCPDisconnected` |

<!-- APPEND:nomenclatura -->

---

## Organizacao por Modulo

> Para backends com multiplos dominios, como organizar por modulo?

```text
Organizacao por subsistema tecnico, nao por modulo HTTP.
Os modulos principais sao: core, memory, knowledge, tools, skills, llm e storage.
```

> Escolha entre organizacao **por camada** (src/domain/, src/application/) ou **por modulo** (src/modules/users/). Nao misture.

---

## Arquivos de Configuracao Raiz

> Quais arquivos de configuracao existem na raiz do projeto?

| Arquivo | Proposito |
| --- | --- |
| `package.json` | Dependencias, scripts e metadados do pacote |
| `tsconfig.json` | Compilacao TypeScript |

| `vitest.config.ts` | Runner e cobertura de testes |
| `README.md` | Documentacao de uso publico |
| `CHANGELOG.md` | Historico de releases e deprecacoes |

> (ver [03-domain.md](03-domain.md) para detalhes das entidades)
