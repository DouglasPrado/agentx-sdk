# Contexto do Sistema

Esta seção estabelece a visão de alto nível do sistema: quem o utiliza, com quais sistemas externos ele se comunica, onde terminam suas responsabilidades e quais restrições moldam as decisões de arquitetura. Use-a como ponto de partida para alinhar stakeholders e equipe técnica sobre o escopo do projeto.

---

## Atores

> Quem interage com o sistema? Liste pessoas, sistemas e dispositivos.

| Ator | Tipo | Descrição |
| --- | --- | --- |
| Desenvolvedor (consumidor da lib) | Pessoa | Integra o pacote `src/agent/` em sua aplicação Node.js para criar agentes conversacionais com LLM, tools, memory e knowledge |
| Aplicação Host | Sistema | Processo Node.js que instancia a classe `Agent`, registra tools/skills e invoca `chat()`/`stream()` |
| Servidor MCP | Sistema | Servidor externo que expõe tools via Model Context Protocol (stdio ou SSE), conectado dinamicamente pelo MCPAdapter |

<!-- APPEND:actors -->

---

## Sistemas Externos

> Com quais sistemas, serviços ou APIs externas o sistema precisa se integrar? Qual o propósito de cada integração?

| Sistema | Protocolo / Tipo de Integração | Função | Observações |
| --- | --- | --- | --- |
| OpenRouter API | REST API (HTTPS) + SSE streaming | Gateway unificado para LLMs (chat completions, embeddings, structured output) | Crítico — sem ele o agente não funciona. Rate limits e billing gerenciados pelo OpenRouter |
| Servidores MCP | stdio / SSE (Model Context Protocol SDK) | Fornecem tools dinâmicas ao agente em runtime | Opcional — dependência `@modelcontextprotocol/sdk` carregada via dynamic import. Reconexão automática com backoff |
| SQLite (local) | Biblioteca embutida (better-sqlite3) | Persistência local de memórias, vetores (knowledge), histórico de conversas | Arquivo único (`~/.agent/data.db`), WAL mode, zero config. Não é um serviço externo, mas é uma dependência de infraestrutura |

<!-- APPEND:external-systems -->

---

## Limites do Sistema

> O que está dentro e fora do escopo deste sistema? Definir limites claros evita ambiguidades e retrabalho.

**O sistema É responsável por:**

- Fornecer uma classe `Agent` OOP standalone para conversação com LLMs via OpenRouter
- Streaming de eventos granulares (`AgentEvent`) via `AsyncIterableIterator`
- Loop ReAct com tool calling (parallel/sequential), error recovery e cost guard
- Gerenciamento de memória com extração automática, decay, consolidação e busca híbrida (FTS5 + embeddings)
- RAG local com ingestão de documentos, chunking, embeddings e busca vetorial
- Sistema de skills com matching por prefix, função customizada e similaridade semântica
- Integração com servidores MCP (conexão, reconexão, isolamento de falhas)
- Persistência local via SQLite (conversas, memórias, vetores)
- Pipeline de contexto com budget de tokens e compactação de histórico
- Controle de custo por execução e por sessão

**O sistema NÃO é responsável por:**

- Fornecer UI/frontend — é uma biblioteca programática (API TypeScript)
- Gerenciar autenticação de usuários finais — responsabilidade da aplicação host
- Prover API HTTP/REST/GraphQL — o consumidor monta seu próprio servidor se necessário
- Hospedar ou gerenciar servidores MCP — apenas se conecta a eles
- Gerenciar billing ou cotas do OpenRouter — apenas contabiliza tokens localmente
- Suportar múltiplos provedores de LLM nativamente — apenas OpenRouter (que roteia para vários) <!-- inferido do PRD -->
- Funcionalidades do dify-agent — 100% independente, sem imports internos

---

## Restrições e Premissas

> Quais restrições técnicas, de negócio ou regulatórias influenciam as decisões de arquitetura? Quais premissas estão sendo assumidas como verdadeiras?

**Restrições:**

| Tipo | Descrição |
| --- | --- |
| Técnica | Zero frameworks de IA — HTTP via `fetch()` nativo (Node 18+), sem SDKs de LLM |
| Técnica | Validação exclusivamente via Zod — proibido uso de TypeBox, AJV ou outros sistemas de schema |
| Técnica | Dependências mínimas: apenas `zod`, `better-sqlite3`, `zod-to-json-schema` e opcionalmente `@modelcontextprotocol/sdk` |
| Técnica | 100% independente do dify-agent — nenhum import interno permitido |
| Técnica | Busca vetorial em SQLite aceitável para até ~100K vetores; volumes maiores requerem store plugável (PgVector, Pinecone) |
| Técnica | Node.js 18+ obrigatório (fetch nativo, dynamic import) |

<!-- APPEND:constraints -->

**Premissas:**

- O OpenRouter estará disponível e acessível com latência aceitável (<2s para primeiro token)
- O volume de vetores em knowledge não ultrapassará 100K no uso típico (SQLite suficiente)
- O consumidor da lib gerencia suas próprias API keys do OpenRouter
- Embeddings serão obtidos via OpenRouter (não há serviço local de embeddings)
- O ambiente de execução terá acesso ao filesystem para persistência SQLite (não roda em browser/edge)
- Conversas concorrentes em threads diferentes são o caso de uso primário; execuções concorrentes na mesma thread são serializadas via mutex

---

## Diagrama de Contexto

> Represente visualmente os atores e sistemas externos que interagem com o sistema. Use o diagrama abaixo como ponto de partida (estilo C4 — nível de contexto).

> 📐 Diagrama: [system-context.mmd](../diagrams/context/system-context.mmd)
