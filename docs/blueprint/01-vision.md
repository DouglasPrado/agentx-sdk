# Visão do Sistema

## Problema

> Qual dor ou necessidade este sistema resolve? Quem sofre com isso hoje?

Desenvolvedores que precisam construir agentes conversacionais com LLMs enfrentam duas opções ruins: (1) usar frameworks pesados como LangChain, Vercel AI SDK ou pi-agent-core que trazem dezenas de dependências transitivas, schemas incompatíveis e abstrações opinativas que dificultam customização; ou (2) implementar tudo do zero, reescrevendo loop ReAct, streaming, tool calling, memory e RAG a cada projeto. O resultado é código acoplado a SDKs específicos, dificuldade de troca de modelo, e custo de manutenção alto. Além disso, o dify-agent existente no projeto não é reutilizável como pacote standalone — ele está acoplado a infraestrutura interna.

---

## Elevator Pitch

Para **desenvolvedores Node.js** que **precisam de agentes conversacionais com tools, memória e RAG sem depender de frameworks pesados**, o **AgentX SDK** é um **pacote TypeScript standalone** que **oferece um agente completo via OOP com streaming, tool calling, memory com aprendizado, knowledge/RAG, skills e MCP — tudo com dependências mínimas e interfaces plugáveis**. Diferente de **frameworks como LangChain, Vercel AI SDK ou pi-agent-core**, nosso sistema **usa apenas `fetch()` nativo para LLM, Zod para validação e SQLite embutido para persistência, resultando em zero lock-in e controle total sobre cada componente**.

---

## Objetivo

> Quais resultados concretos esperamos alcançar com este sistema? Como saberemos que ele foi bem-sucedido?

- **Independência total**: Pacote 100% standalone em `src/agent/`, sem nenhum import do dify-agent ou frameworks de IA
- **API minimalista**: Uma única classe `Agent` com `chat()` e `stream()` como ponto de entrada, configurável via `AgentConfig` com Zod
- **Streaming first**: Todos os eventos granulares (`AgentEvent`) entregues via `AsyncIterableIterator` com backpressure
- **Subsistemas completos**: Memory (extração + decay + busca híbrida), Knowledge/RAG (chunking + embeddings + busca vetorial), Tools (Zod + parallel/sequential), Skills (prefix + semântico), MCP (dynamic import + reconnect)
- **Dependências mínimas**: Apenas 4 pacotes (`zod`, `better-sqlite3`, `zod-to-json-schema`, opcionalmente `@modelcontextprotocol/sdk`)
- **Produção-ready**: Cost guard, mutex por thread, error recovery, mensagens pinadas, pipeline de contexto com budget

<!-- APPEND:objectives -->

---

## Usuários

> Quem são as pessoas (ou sistemas) que vão interagir diretamente com esta solução?

| Persona | Necessidade | Frequência de Uso |
| ------- | ----------- | ----------------- |
| Desenvolvedor backend | Integrar agente conversacional em APIs/serviços Node.js com controle fino sobre tools, memory e streaming | Diário |
| Desenvolvedor fullstack | Criar chatbots e assistentes com RAG sobre documentação própria, sem gerenciar infra de vetores | Semanal |
| Desenvolvedor de automação | Usar agente com tools customizadas e MCP servers para automação de workflows | Semanal |
| Aplicação host (sistema) | Instanciar múltiplas instâncias de Agent com threads isoladas para atender usuários concorrentes | Contínuo |

<!-- APPEND:personas -->

---

## Valor Gerado

> Que valor tangível este sistema entrega para cada grupo de usuários e para o negócio?

- **Redução de dependências**: De dezenas de pacotes transitivos (SDKs de IA) para 4 dependências diretas — menor superfície de ataque e bundle size
- **Time-to-agent**: De semanas implementando loop ReAct + memory + RAG para horas configurando um `AgentConfig` — aceleração de ~10x no bootstrap
- **Portabilidade de modelo**: Troca de LLM via string de config (`model: "anthropic/claude-sonnet-4"` → `model: "openai/gpt-4o"`) sem mudança de código
- **Controle de custo**: Cost guard com limites por execução e sessão evita surpresas na fatura do OpenRouter
- **Persistência zero-config**: SQLite embutido com WAL mode — dados sobrevivem restart sem precisar de Postgres, Redis ou serviços externos
- **Extensibilidade sem lock-in**: Interfaces plugáveis (`MemoryStore`, `VectorStore`, `ConversationStore`) permitem migrar para qualquer backend

---

## Métricas de Sucesso

> Como vamos medir se o sistema está cumprindo seus objetivos?

| Métrica | Meta | Como Medir |
| ------- | ---- | ---------- |
| Compilação sem erros | 0 erros em `tsc --noEmit` | CI pipeline |
| Cobertura de funcionalidades | 100% das features do PRD implementadas (30 arquivos) | Checklist de arquivos + testes manuais |
| Latência do primeiro token | < 500ms após chamada `stream()` (excluindo latência do OpenRouter) | Benchmark local com tracing |
| Dependências diretas | ≤ 4 pacotes em `dependencies` do package.json | Auditoria de package.json |
| Zero imports do dify-agent | 0 referências a módulos fora de `src/agent/` | Grep automatizado no CI |
| Memory recall accuracy | Memórias explícitas recuperadas em >90% dos casos | Testes automatizados com cenários de recall |

<!-- APPEND:success-metrics -->

---

## Não-objetivos

> O que este sistema deliberadamente NÃO faz? Quais problemas adjacentes estão fora do escopo?

- **Não é um framework web**: Não fornece rotas HTTP, middleware, autenticação ou frontend — é uma biblioteca programática
- **Não substitui o dify-agent**: Coexiste como pacote independente, sem migração ou deprecação do dify-agent
- **Não gerencia infraestrutura**: Não provisiona banco de dados, servidores MCP ou serviços de embedding — apenas se conecta a eles
- **Não suporta browser/edge**: Requer Node.js 18+ com filesystem (SQLite) — não roda em Cloudflare Workers, Deno Deploy ou browser
- **Não é multi-provider nativo**: Conecta exclusivamente ao OpenRouter (que roteia para múltiplos providers) — não implementa SDKs individuais
- **Não faz fine-tuning ou treinamento**: Trabalha apenas com modelos pré-treinados via API de inferência
