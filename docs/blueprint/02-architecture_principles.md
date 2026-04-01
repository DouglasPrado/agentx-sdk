# Princípios Arquiteturais

Liste 3 a 7 princípios que guiam todas as decisões técnicas do sistema. Esses princípios funcionam como um filtro: quando houver dúvida entre duas abordagens, os princípios devem apontar o caminho.

> Se dois engenheiros discordarem sobre uma decisão técnica, quais princípios devem guiar a resolução?

---

## Seus Princípios

### 1. Dependências mínimas, controle máximo

**Descrição:** Cada dependência externa deve justificar sua existência. Se algo pode ser feito com APIs nativas do Node.js (como `fetch()`) ou com poucas linhas de código, não adicione uma biblioteca.

**Justificativa:** O PRD rejeitou explicitamente o pi-agent-core porque suas deps pesadas (OpenAI SDK + Anthropic SDK + Google GenAI SDK + TypeBox + AJV) superavam o valor entregue. O loop ReAct são ~200 linhas — não justifica um framework. Manter dependências mínimas reduz superfície de ataque, bundle size e risco de breaking changes.

**Implicações:**
- HTTP via `fetch()` nativo — proibido adicionar axios, got, node-fetch ou SDKs de LLM
- Validação exclusivamente via Zod — proibido TypeBox, AJV, Joi ou io-ts
- Toda nova dependência requer justificativa documentada em ADR antes de ser adicionada
- O pacote final deve ter ≤ 4 dependências diretas em `dependencies`

---

### 2. Interfaces plugáveis, implementações opinativas

**Descrição:** Cada subsistema expõe uma interface (TypeScript interface) que define o contrato, e fornece uma implementação padrão baseada em SQLite. Consumidores podem substituir qualquer implementação sem alterar o core.

**Justificativa:** O sistema precisa funcionar out-of-the-box (SQLite, zero config) mas também ser extensível para produção (PgVector, Redis, Pinecone). Interfaces plugáveis resolvem ambos os cenários sem comprometer simplicidade.

**Implicações:**
- `MemoryStore`, `VectorStore`, `ConversationStore` são interfaces — não classes concretas no core
- Implementações padrão (`SQLiteMemoryStore`, `SQLiteVectorStore`) são fornecidas mas nunca referenciadas diretamente pelo Agent
- Testes unitários mockam as interfaces, testes de integração usam as implementações SQLite
- Novos backends (Postgres, Pinecone) são adicionados sem tocar no código do Agent

---

### 3. Streaming como cidadão de primeira classe

**Descrição:** Todo fluxo de dados do agente é projetado para streaming. `chat()` é um wrapper sobre `stream()`, nunca o contrário. Eventos granulares (`AgentEvent`) são a unidade fundamental de comunicação.

**Justificativa:** Agentes conversacionais com LLM têm latência inerente (segundos). Streaming com backpressure é essencial para UX responsiva e para permitir que consumidores reajam a eventos intermediários (tool calls, memory extraction, warnings).

**Implicações:**
- `stream()` retorna `AsyncIterableIterator<AgentEvent>` — é a API primária
- `chat()` consome `stream()` internamente e retorna apenas o texto final
- O `StreamEmitter` implementa bounded queue com backpressure — nunca acumula eventos ilimitados em memória
- Todos os subsistemas (tools, memory, knowledge) emitem eventos ao invés de retornar resultados silenciosamente

---

### 4. Falhe explicitamente, recupere graciosamente

**Descrição:** Quando algo falha, o sistema emite um evento de erro com contexto suficiente para diagnóstico. Quando possível, recupera automaticamente (retry, fallback) sem interromper o fluxo principal.

**Justificativa:** O ReactLoop interage com serviços externos (OpenRouter, MCP servers) que podem falhar a qualquer momento. Falhas silenciosas corrompem o estado da conversa. Error recovery (retry com backoff, `onToolError: 'continue'`) mantém o agente funcional mesmo com falhas parciais.

**Implicações:**
- Tool errors com `onToolError: 'continue'` enviam o erro como tool_result ao LLM — o modelo decide como proceder
- MCP servers com reconexão automática (backoff exponencial) e isolamento de falhas por tool
- `maxConsecutiveErrors` para o loop após N erros seguidos — evita loops infinitos
- Todos os erros incluem `traceId` para correlação no ExecutionContext

---

### 5. Isolamento por design

**Descrição:** Threads de conversa, execuções de tools, conexões MCP e contextos de execução são isolados entre si. Falha ou estado de um não contamina outro.

**Justificativa:** O sistema suporta múltiplas threads concorrentes e múltiplos MCP servers. Sem isolamento, uma tool travada pode bloquear todas as conversas, ou uma thread pode vazar memória para outra.

**Implicações:**
- `ConversationManager` usa mutex por thread — execuções concorrentes na mesma thread são serializadas, threads diferentes rodam em paralelo
- Cada tool MCP roda com timeout individual — uma tool travada não afeta as outras do mesmo server
- `ExecutionContext` com `traceId` único por execução permite rastrear eventos sem ambiguidade
- Memory com scope `thread` é visível apenas na sua thread; scope `persistent` é global

---

### 6. Custo como constraint de primeira classe

**Descrição:** O consumo de tokens (e portanto custo monetário) é monitorado, limitado e reportado em todas as operações. Nenhuma execução pode consumir recursos ilimitados.

**Justificativa:** LLMs cobram por token. Um loop ReAct descontrolado pode gastar centenas de dólares em minutos. Cost guard com limites por execução e por sessão é a única proteção confiável contra runaway costs.

**Implicações:**
- `CostPolicy` com `maxTokensPerExecution` e `maxTokensPerSession` é verificada antes de cada chamada ao LLM
- `maxToolCallsPerExecution` previne loops infinitos de tool calling
- `AgentEvent` de tipo `agent_end` sempre inclui `TokenUsage` acumulado
- `getUsage()` expõe custo da sessão a qualquer momento — consumidor pode tomar decisões de negócio

---

### 7. Observabilidade embutida

**Descrição:** Todo evento relevante é emitido com identificação única (`traceId`), timing e contexto suficiente para debugging e integração com sistemas de monitoramento externos.

**Justificativa:** Agentes com LLM são não-determinísticos. Sem observabilidade granular, debugar por que o agente tomou uma decisão errada ou por que uma tool falhou é praticamente impossível.

**Implicações:**
- `ExecutionContext` com `traceId` acompanha todos os eventos de uma execução
- Eventos incluem `duration` (tool calls, agent execution) para análise de latência
- `AgentHooks.onEvent` permite integrar com OpenTelemetry, Datadog ou qualquer sistema de tracing
- Logger mínimo embutido com levels — sem dependência de winston, pino ou bunyan

<!-- APPEND:principles -->
