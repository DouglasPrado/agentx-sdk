Ve# Visao do Backend

Define a stack tecnologica, principios de design e objetivos do backend. Este documento e o ponto de partida para qualquer decisao de implementacao.

---

## Stack Tecnologica

> Quais tecnologias formam a fundacao do backend?

<!-- do blueprint: 00-context.md, 02-architecture_principles.md, 05-data-model.md, 06-system-architecture.md, 10-architecture_decisions.md -->

| Camada             | Tecnologia                                   | Versao         | Justificativa                                                               |
| ------------------ | -------------------------------------------- | -------------- | --------------------------------------------------------------------------- |
| Linguagem          | TypeScript                                   | 5.x            | Tipagem estatica, API publica clara e compatibilidade com o ecossistema npm |
| Runtime            | Node.js                                      | 22+            | `fetch()` nativo, `AbortSignal`, dynamic import e filesystem disponivel     |
| Framework          | Nenhum                                       | N/A            | O sistema e uma biblioteca standalone in-process, nao um servidor HTTP      |
| Validacao          | Zod                                          | 3.x            | Unico sistema de validacao permitido pelos ADRs                             |
| Persistencia       | `better-sqlite3` + SQLite                    | 3.x / SQLite 3 | Arquivo unico, WAL mode, FTS5 e zero config                                 |
| Contratos de tools | `zod-to-json-schema`                         | 3.x            | Conversao de schemas Zod para function/tool calling                         |
| Cache              | Cache LRU em memoria                         | Interno        | Zero dependencias extras; TTL configuravel para embeddings e buscas         |
| Mensageria         | `AsyncIterableIterator` + eventos in-process | Interno        | Streaming first; sem broker externo por padrao                              |

<!-- APPEND:stack -->

---

## Padrao Arquitetural

> Qual padrao arquitetural o backend segue? Descreva as camadas e suas responsabilidades.

<!-- do blueprint: 02-architecture_principles.md, 06-system-architecture.md -->

Arquitetura em camadas com nucleo orientado a dominio e interfaces plugaveis. Na pratica, o pacote segue um estilo proximo de hexagonal/light clean architecture: o dominio e o core definem contratos e comportamento; adapters concretos implementam persistencia SQLite, OpenRouter e MCP. Como se trata de uma biblioteca, a borda externa nao e HTTP, e sim a API publica TypeScript exposta por `Agent` e seus tipos.

**Camadas:**

| Camada           | Responsabilidade                                                                                      | Depende de        | Nao depende de                    |
| ---------------- | ----------------------------------------------------------------------------------------------------- | ----------------- | --------------------------------- |
| Public API       | Receber chamadas `chat()`, `stream()`, `remember()`, `recall()`, `ingestKnowledge()` e `connectMCP()` | Application, Core | Implementacoes concretas internas |
| Application/Core | Orquestrar fluxos, budget, tracing, hooks, tools, memory, knowledge e skills                          | Domain, Ports     | Consumers externos                |
| Domain           | Entidades, regras, estados, eventos de dominio e contratos                                            | Nada              | Tudo externo                      |
| Infrastructure   | SQLite, OpenRouter, MCP, caches e stores concretos                                                    | Domain, Ports     | Public API                        |

<!-- APPEND:camadas -->

---

## Principios de Design

> Quais principios guiam as decisoes de implementacao do backend?

<!-- do blueprint: 02-architecture_principles.md -->

| Principio                                    | Descricao                                                       | Implicacao Pratica                                                        |
| -------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Dependencias minimas, controle maximo        | Cada dependencia precisa se justificar                          | Sem SDKs de LLM, sem ORM, sem framework web no core                       |
| Interfaces plugaveis                         | Contratos estaveis com implementacoes padrao                    | `MemoryStore`, `VectorStore` e `ConversationStore` isolam a persistencia  |
| Streaming first                              | `stream()` e a API primaria                                     | `chat()` consome `stream()` internamente; eventos sao a unidade principal |
| Falhe explicitamente, recupere graciosamente | Erros precisam ser observaveis e, quando possivel, recuperaveis | Retry com backoff, `onToolError`, warnings e stop controlado              |
| Isolamento por design                        | Threads, tools e MCP ficam isolados                             | Mutex por thread, timeout por tool, `traceId` por execucao                |
| Custo como constraint                        | Tokens e tool calls sao recursos governados                     | CostPolicy aplicada antes de cada chamada ao LLM                          |
| Observabilidade embutida                     | Todo fluxo relevante precisa ser rastreavel                     | Eventos com `traceId`, `duration`, `threadId` e hooks de integracao       |

<!-- APPEND:principios -->

---

## Objetivos e Metricas

> Quais resultados o backend deve atingir?

<!-- do blueprint: 01-vision.md, 03-requirements.md, 07-critical_flows.md, 15-observability.md -->

| Metrica                         | Meta          | Como Medir                                                    |
| ------------------------------- | ------------- | ------------------------------------------------------------- |
| Overhead interno por execucao   | < 50ms        | Benchmarks e eventos `agent_end.duration` sem latencia de LLM |
| Time to first token interno     | < 50ms        | Tracing em `stream()`                                         |
| Busca FTS5 em memórias          | < 10ms        | Integration/load tests sobre `SQLiteMemoryStore`              |
| Busca vetorial em 50K vetores   | < 100ms       | Benchmarks do `SQLiteVectorStore`                             |
| Threads concorrentes            | >= 100        | Testes de concorrencia do `ConversationManager`               |
| Dependencias diretas            | <= 4          | Auditoria de `package.json`                                   |
| Zero imports externos ao pacote | 0 referencias | Grep automatizado no CI                                       |

<!-- APPEND:metricas -->

---

## Nao-objetivos

> O que o backend deliberadamente NAO faz nesta versao?

<!-- do blueprint: 00-context.md, 01-vision.md -->

- Nao fornece API HTTP, REST ou GraphQL pronta
- Nao implementa autenticacao de usuarios finais da aplicacao host
- Nao hospeda ou gerencia servidores MCP
- Nao suporta browser, edge runtime ou multiplos providers de LLM nativos nesta versao
- Nao inclui criptografia nativa do SQLite nesta versao

---

## Provedores e Infraestrutura

> Quais servicos de cloud e provedores externos o backend utiliza?

<!-- do blueprint: 00-context.md, 06-system-architecture.md, 17-communication.md -->

| Servico            | Provedor                  | Funcao                                                     | Ambiente            |
| ------------------ | ------------------------- | ---------------------------------------------------------- | ------------------- |
| LLM gateway        | OpenRouter API            | Chat completions, streaming SSE e embeddings               | Dev, Test E2E, Prod |
| Persistencia local | SQLite (`better-sqlite3`) | Conversas, memórias e vetores                              | Dev, Test, Prod     |
| Tools externas     | Servidores MCP            | Ferramentas dinamicas via stdio/SSE                        | Opcional            |
| Filesystem do host | Sistema operacional       | Armazenar `~/.agent/data.db` e assets locais do consumidor | Dev, Prod           |

<!-- APPEND:provedores -->

> (ver [01-architecture.md](01-architecture.md) para detalhes de deploy e infraestrutura)
