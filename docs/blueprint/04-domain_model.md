# Modelo de Domínio

O modelo de domínio representa as entidades centrais do sistema, suas responsabilidades e como se relacionam entre si. Ele serve como a **linguagem compartilhada** entre equipe técnica e stakeholders, garantindo que todos falem o mesmo idioma ao discutir o produto.

> O modelo de domínio NÃO é o modelo de dados. Aqui focamos no **comportamento e nas regras de negócio**, não na estrutura de armazenamento.

---

## Glossário Ubíquo

> Quais termos do domínio precisam de definição clara para evitar ambiguidade?
> **Fonte unica de termos:** [docs/shared/glossary.md](../shared/glossary.md). Ao preencher esta secao, atualize tambem o glossario compartilhado.

| Termo | Definição |
|-------|-----------|
| Agent | Entidade principal que orquestra conversação com LLM. Gerencia tools, memory, knowledge, skills e o loop ReAct |
| AgentEvent | Unidade atômica de comunicação do Agent — cada evento granular (text_delta, tool_call_start, etc.) emitido via streaming |
| ReactLoop | Ciclo iterativo de raciocínio: envia mensagens ao LLM → recebe resposta → se tool_calls, executa tools → repete até texto final ou limite |
| Tool | Função externa que o Agent pode invocar durante o ReactLoop. Definida com schema Zod, executada com validação |
| Skill | Conjunto de instruções + tools opcionais que modificam o comportamento do Agent quando ativado por matching de input |
| Memory | Fato extraído de conversas que persiste entre sessões. Tem scope (thread/persistent/learned), confidence e ciclo de decay |
| Knowledge | Documento ingerido, dividido em chunks e armazenado como vetores para busca RAG (Retrieval-Augmented Generation) |
| Thread | Contexto isolado de conversa identificado por threadId. Cada thread tem seu próprio histórico e mutex |
| ContentPart | Unidade de conteúdo multimodal — pode ser texto ou image_url |
| ContextPipeline | Pipeline ordenado de stages que constrói o contexto (system prompt + injections + histórico) respeitando budget de tokens |
| ContextInjection | Bloco de conteúdo injetado no contexto por um subsistema (skills, knowledge, memory) com prioridade para corte |
| CostPolicy | Política de limites de custo por execução e por sessão que previne consumo descontrolado de tokens |
| StreamEmitter | Canal async push/pull com bounded queue e backpressure para entrega de AgentEvents |
| ExecutionContext | Contexto de rastreamento com traceId único que acompanha todos os eventos de uma execução |
| MCP | Model Context Protocol — protocolo para conectar tools externas via stdio ou SSE |

<!-- APPEND:glossary -->

---

## Entidades

> Quais são os conceitos centrais que o sistema precisa representar? Cada entidade deve ter identidade própria e ciclo de vida bem definido.

### Agent

**Descrição:** Ponto de entrada principal do sistema. Orquestra todos os subsistemas (LLM, tools, memory, knowledge, skills, MCP) e expõe a API pública `chat()`/`stream()`.

**Atributos:**

| Nome | Tipo | Obrigatório | Descrição |
|------|------|:-----------:|-----------|
| config | AgentConfig | Sim | Configuração validada via Zod (apiKey, model, tools, memory, etc.) |
| conversations | ConversationManager | Sim | Gerenciador de threads de conversa com mutex |
| costAccumulator | TokenUsage | Sim | Acumulador de tokens (input + output) da sessão |
| toolExecutor | ToolExecutor | Sim | Executor de tools registradas |
| memoryManager | MemoryManager | Não | Gerenciador de memória (se memory habilitado) |
| knowledgeManager | KnowledgeManager | Não | Gerenciador de RAG (se knowledge habilitado) |
| skillManager | SkillManager | Não | Gerenciador de skills (se skills registradas) |
| mcpAdapter | MCPAdapter | Não | Adaptador MCP (se MCP configurado) |
| contextPipeline | ContextPipeline | Sim | Pipeline de construção de contexto |

**Regras de Negócio:**

- `apiKey` é obrigatório e não pode ser string vazia
- `chat()` é um wrapper sobre `stream()` — nunca implementa lógica própria
- Execuções concorrentes na mesma thread são serializadas via mutex do ConversationManager
- Ao atingir `maxTokensPerSession`, novas chamadas são bloqueadas ou emitem warning conforme CostPolicy
- `destroy()` deve fechar conexões MCP e SQLite antes de liberar recursos

---

### ChatMessage

**Descrição:** Mensagem individual em uma conversa. Pode ser do usuário, do assistente, do sistema ou resultado de tool.

**Atributos:**

| Nome | Tipo | Obrigatório | Descrição |
|------|------|:-----------:|-----------|
| role | string | Sim | "user" \| "assistant" \| "system" \| "tool" |
| content | string \| ContentPart[] | Sim | Conteúdo textual ou multimodal |
| tool_calls | ToolCall[] | Não | Tool calls geradas pelo LLM (role=assistant) |
| tool_call_id | string | Não | ID da tool call respondida (role=tool) |
| pinned | boolean | Não | Se true, sobrevive à compactação de histórico |

**Regras de Negócio:**

- Mensagens com `role: "tool"` devem ter `tool_call_id` correspondente a um tool_call anterior
- Mensagens com `pinned: true` nunca são sumarizadas pelo ContextBuilder
- Limite de 20 mensagens pinadas por thread (configurável) — acima disso, as mais antigas perdem o pin

---

### Memory

**Descrição:** Fato ou conhecimento extraído de conversas que persiste entre sessões. Possui ciclo de vida com decay de confidence.

**Atributos:**

| Nome | Tipo | Obrigatório | Descrição |
|------|------|:-----------:|-----------|
| id | string | Sim | Identificador único |
| content | string | Sim | Conteúdo textual da memória |
| scope | MemoryScope | Sim | "thread" \| "persistent" \| "learned" |
| category | string | Sim | "fact" \| "preference" \| "procedure" \| "insight" \| "context" |
| confidence | number | Sim | 0.0-1.0 — decai com o tempo, reforça com acesso |
| accessCount | number | Sim | Quantas vezes foi recuperada em buscas |
| source | string | Sim | "extracted" \| "explicit" \| "feedback" |
| threadId | string | Não | Thread de origem (obrigatório se scope=thread) |
| embedding | Float32Array | Não | Vetor de embedding para busca semântica |
| createdAt | number | Sim | Timestamp de criação |
| lastAccessedAt | number | Sim | Timestamp do último acesso |

**Regras de Negócio:**

- Confidence inicial: 0.8 (extraída) ou 1.0 (explícita do usuário)
- A cada acesso: `confidence += 0.05` (reforço por uso), cap em 1.0
- A cada N turnos (decayInterval): `confidence *= decayFactor` para memórias não acessadas
- Memórias com `confidence < minConfidence` (default 0.1) são removidas automaticamente
- Memórias similares são consolidadas periodicamente (dedup semântica)
- Memórias com scope "thread" só são visíveis na thread correspondente

---

### AgentTool

**Descrição:** Função externa que o Agent pode invocar. Definida com schema Zod para validação de argumentos.

**Atributos:**

| Nome | Tipo | Obrigatório | Descrição |
|------|------|:-----------:|-----------|
| name | string | Sim | Nome único da tool |
| description | string | Sim | Descrição para o LLM entender quando usar |
| parameters | ZodSchema | Sim | Schema Zod dos argumentos |
| execute | Function | Sim | Função que executa a tool (recebe args validados + AbortSignal) |
| validate | Function | Não | Validação semântica opcional (recebe args + contexto de conversa) |

**Regras de Negócio:**

- Nome deve ser único no registro do ToolExecutor
- Argumentos são validados via Zod antes de execução — falha de validação retorna erro imediato
- Se `validate()` definido, roda após validação Zod e antes de `execute()`
- `execute()` pode retornar `string` (simples) ou `AgentToolResult` (rico com metadata)
- Recebe `AbortSignal` para suportar cancelamento mid-execution

---

### AgentSkill

**Descrição:** Modificador de comportamento do Agent. Quando ativado, injeta instruções e tools opcionais no contexto.

**Atributos:**

| Nome | Tipo | Obrigatório | Descrição |
|------|------|:-----------:|-----------|
| name | string | Sim | Nome único da skill |
| description | string | Sim | Descrição (usada para matching semântico) |
| instructions | string | Sim | Instruções injetadas no contexto quando ativa |
| tools | AgentTool[] | Não | Tools exclusivas desta skill |
| match | Function | Não | Função customizada de matching |
| triggerPrefix | string | Não | Prefixo para match direto (ex: "/review") |
| priority | number | Não | Desempate: maior prioridade vence (default: 0) |
| exclusive | boolean | Não | Se true, bloqueia outras skills quando ativa |

**Regras de Negócio:**

- Skills com `exclusive: true` têm prioridade absoluta — só uma ativa por vez
- Matching em 3 níveis: triggerPrefix (exato) → match() customizado → semântico (similaridade > 0.7)
- Desempate por prioridade (desc), depois por especificidade (prefix > custom > semântico)
- Máximo de 3 skills ativas simultaneamente (configurável)

---

### KnowledgeDocument

**Descrição:** Documento ingerido para RAG. Dividido em chunks, cada chunk recebe embedding e é armazenado no VectorStore.

**Atributos:**

| Nome | Tipo | Obrigatório | Descrição |
|------|------|:-----------:|-----------|
| content | string | Sim | Conteúdo textual do documento |
| metadata | Record | Não | Metadados arbitrários (título, fonte, etc.) |

**Regras de Negócio:**

- Na ingestão, o documento é dividido em chunks pela ChunkingStrategy configurada
- Cada chunk recebe embedding via EmbeddingService e é armazenado no VectorStore
- Chunks mantêm referência ao documento original via metadata
- Busca retorna `RetrievedKnowledge` com score de similaridade

---

### ExecutionContext

**Descrição:** Contexto de rastreamento que acompanha todos os eventos de uma execução `chat()`/`stream()`.

**Atributos:**

| Nome | Tipo | Obrigatório | Descrição |
|------|------|:-----------:|-----------|
| traceId | string | Sim | UUID único por execução |
| threadId | string | Sim | Thread da conversa |
| startedAt | number | Sim | Timestamp de início |
| model | string | Sim | Modelo usado nesta execução |
| parentTraceId | string | Não | Para sub-execuções (ex: memory extraction) |

**Regras de Negócio:**

- Cada chamada `chat()`/`stream()` gera um novo ExecutionContext
- Todos os AgentEvents emitidos incluem o traceId correspondente
- Sub-execuções (como extração de memória) têm seu próprio traceId com parentTraceId apontando para a execução principal

<!-- APPEND:entities -->

---

## Relacionamentos

> Como as entidades se conectam? Quais dependências existem entre elas?

| Entidade A | Cardinalidade | Entidade B | Descrição do Relacionamento |
|------------|:-------------:|------------|----------------------------|
| Agent | 1:1 | ConversationManager | Agent possui um ConversationManager que gerencia todas as threads |
| Agent | 1:1 | ToolExecutor | Agent possui um ToolExecutor com todas as tools registradas |
| Agent | 1:1 | ContextPipeline | Agent possui um pipeline de construção de contexto |
| Agent | 0:1 | MemoryManager | Agent opcionalmente possui um MemoryManager (se memory habilitado) |
| Agent | 0:1 | KnowledgeManager | Agent opcionalmente possui um KnowledgeManager (se knowledge habilitado) |
| Agent | 0:1 | SkillManager | Agent opcionalmente possui um SkillManager (se skills registradas) |
| Agent | 0:1 | MCPAdapter | Agent opcionalmente possui um MCPAdapter (se MCP configurado) |
| ConversationManager | 1:N | Thread (ChatMessage[]) | Cada thread é uma lista isolada de ChatMessages |
| ToolExecutor | 1:N | AgentTool | Executor mantém registro de múltiplas tools |
| SkillManager | 1:N | AgentSkill | Manager mantém registro de múltiplas skills |
| MemoryManager | 1:1 | MemoryStore | Manager usa um store plugável para persistência |
| KnowledgeManager | 1:1 | VectorStore | Manager usa um store plugável para vetores |
| KnowledgeManager | 1:1 | EmbeddingService | Manager usa um serviço de embeddings para ingestão e busca |
| MCPAdapter | 1:N | AgentTool | Cada servidor MCP conectado expõe N tools convertidas para AgentTool |
| ReactLoop | 1:1 | OpenRouterClient | Loop usa o client LLM para chat/stream |
| ReactLoop | 1:1 | ToolExecutor | Loop usa o executor para rodar tools |
| ExecutionContext | 1:N | AgentEvent | Cada contexto produz N eventos rastreados pelo mesmo traceId |
| Memory | N:1 | Thread | Memórias com scope "thread" pertencem a uma thread específica |

<!-- APPEND:relationships -->

---

## Diagrama de Domínio

> Atualize o diagrama abaixo conforme as entidades e relacionamentos definidos acima.

> 📐 Diagrama: [class-diagram.mmd](../diagrams/domain/class-diagram.mmd)

---

## Referências

- PRD: `docs/prd.md` — especificação detalhada de todas as interfaces TypeScript
- Inspiração: pi-agent-core (eventos granulares, hooks, tool execution) — decisão de não usar documentada no PRD
