# Dominio

Define as entidades do sistema, value objects, regras de negocio (invariantes), eventos de dominio e maquinas de estado. Esta e a camada mais interna — nao depende de nenhuma outra.

---

## Glossario Ubiquo

> **Fonte unica:** [docs/shared/glossary.md](../shared/glossary.md). Nao duplique termos aqui — consulte e atualize o glossario compartilhado.

---

## Entidades

> Para cada entidade, documente atributos, invariantes, metodos e eventos. Cada entidade encapsula suas proprias regras.

<!-- do blueprint: 04-domain-model.md, 09-state-models.md -->
### Agent

**Descricao:** Agregado raiz que orquestra configuracao, subsistemas, sessao e ciclo de vida de execucao.

**Atributos:**

| Campo | Tipo | Obrigatorio | Validacao | Descricao |
| --- | --- | --- | --- | --- |
| config | AgentConfig | sim | Zod schema valido | Configuracao completa do agente |
| conversations | ConversationManager | sim | instancia pronta | Gerencia threads e mutex |
| costAccumulator | TokenUsage | sim | nao negativo | Acumulado da sessao |
| toolExecutor | ToolExecutor | sim | instancia pronta | Registro e execucao de tools |
| contextPipeline | ContextPipeline | sim | instancia pronta | Monta contexto por budget |
| memoryManager | MemoryManager | nao | opcional | Subsis. de memory |
| knowledgeManager | KnowledgeManager | nao | opcional | Subsis. de RAG |
| skillManager | SkillManager | nao | opcional | Subsis. de skills |
| mcpAdapter | MCPAdapter | nao | opcional | Integracao MCP |
| sessionState | AgentSessionState | sim | enum | `initializing`, `ready`, `executing`, `cost_exhausted`, `destroying`, `destroyed` |

**Invariantes (regras que NUNCA podem ser violadas):**

- `apiKey` nao pode ser vazia
- `chat()` nunca implementa fluxo proprio; sempre delega para `stream()`
- execucoes concorrentes na mesma thread devem ser serializadas
- ao atingir `maxTokensPerSession` com politica `stop`, nao aceita novas execucoes
- `destroy()` deve fechar MCP e SQLite antes de encerrar a instancia

**Metodos:**

| Metodo | Parametros | Retorno | Descricao |
| --- | --- | --- | --- |
| `create(config)` | `AgentConfigInput` | `Agent` | Valida config, inicializa subsistemas e entra em `ready` |
| `stream(input, options?)` | `string | ContentPart[]`, `ChatOptions?` | `AsyncIterableIterator<AgentEvent>` | Executa pipeline completo e emite eventos |
| `chat(input, options?)` | `string | ContentPart[]`, `ChatOptions?` | `Promise<string>` | Consome `stream()` e retorna apenas texto final |
| `addTool(tool)` | `AgentTool` | `void` | Registra ou sobrescreve tool |
| `addSkill(skill)` | `AgentSkill` | `void` | Registra skill |
| `connectMCP(config)` | `MCPConnectionConfig` | `Promise<void>` | Conecta servidor MCP e registra tools |
| `remember(content, scope?)` | `string, MemoryScope?` | `Promise<Memory>` | Persiste memoria explicita |
| `recall(query)` | `string` | `Promise<Memory[]>` | Busca memorias rankeadas |
| `ingestKnowledge(doc)` | `KnowledgeDocument` | `Promise<void>` | Faz chunking, embedding e persistencia |
| `getUsage()` | — | `TokenUsage` | Retorna custo acumulado |
| `destroy()` | — | `Promise<void>` | Encerra recursos e entra em `destroyed` |

**Eventos Emitidos:**

| Evento | Quando | Payload |
| --- | --- | --- |
| `AgentStarted` | Inicio da execucao | `traceId`, `threadId`, `model` |
| `AgentEnded` | Fim da execucao | `traceId`, `usage`, `reason`, `duration` |
| `AgentDestroyed` | Cleanup concluido | `timestamp` |

### ChatMessage

**Descricao:** Unidade de historico de conversa usada no contexto e na persistencia.

**Atributos:**

| Campo | Tipo | Obrigatorio | Validacao | Descricao |
| --- | --- | --- | --- | --- |
| role | `user | assistant | system | tool` | sim | enum | Papel da mensagem |
| content | `string | ContentPart[]` | sim | nao vazio | Conteudo textual ou multimodal |
| toolCalls | `ToolCall[]` | nao | coerencia com role | Tool calls emitidas pelo LLM |
| toolCallId | string | nao | obrigatorio se role=`tool` | Correlacao da resposta da tool |
| pinned | boolean | nao | default false | Impede compactacao |
| createdAt | number | sim | timestamp | Ordem cronologica |

**Invariantes:**

- mensagens `tool` exigem `toolCallId`
- maximo de 20 mensagens pinadas por thread
- mensagens pinadas nao podem ser sumarizadas

**Metodos:** `createUserMessage()`, `createAssistantMessage()`, `createToolResult()`, `pin()`, `unpin()`, `toOpenRouterMessage()`

**Eventos Emitidos:** `MessagePinned`, `MessageUnpinned`

### Memory

**Descricao:** Fato persistente recuperavel por busca hibrida.

**Atributos:**

| Campo | Tipo | Obrigatorio | Validacao | Descricao |
| --- | --- | --- | --- | --- |
| id | string | sim | UUID | Identificador |
| content | string | sim | nao vazio | Conteudo da memoria |
| scope | `thread | persistent | learned` | sim | enum | Escopo de visibilidade |
| category | string | sim | enum documentado | Categoria semantica |
| confidence | number | sim | 0.0-1.0 | Forca da memoria |
| accessCount | number | sim | >= 0 | Contador de recall |
| source | `extracted | explicit | feedback` | sim | enum | Origem |
| threadId | string | nao | obrigatorio se scope=`thread` | Thread associada |
| embedding | Float32Array | nao | opcional | Vetor semantico |
| createdAt | number | sim | timestamp | Criacao |
| lastAccessedAt | number | sim | timestamp | Ultimo uso |
| state | `active | reinforced | decaying | consolidated | expired | removed` | sim | enum | Estado do ciclo de vida |

**Invariantes:**

- `scope=thread` exige `threadId`
- `confidence` nunca sai do intervalo 0-1
- memoria expirada nao pode ser reforcada sem reativacao explicita

**Metodos:** `createExtracted()`, `createExplicit()`, `reinforce()`, `applyDecay()`, `markExpired()`, `consolidateWith(other)`

**Eventos Emitidos:** `MemoryExtracted`, `MemoryReinforced`, `MemoryExpired`, `MemoryConsolidated`, `MemoryRemoved`

### AgentTool

**Descricao:** Capacidade executavel validada antes da invocacao.

**Atributos:** `name`, `description`, `parameters`, `execute`, `validate`

**Invariantes:** nome unico, schema obrigatorio, `execute()` cancelavel via `AbortSignal`

**Metodos:** `toJsonSchema()`, `validateArgs()`, `validateSemantics()`, `run()`

**Eventos Emitidos:** `ToolCallStarted`, `ToolCallEnded`, `ToolValidationFailed`

### AgentSkill

**Descricao:** Comportamento especializado ativado por match de input.

**Atributos:** `name`, `description`, `instructions`, `tools?`, `match?`, `triggerPrefix?`, `priority?`, `exclusive?`

**Invariantes:** nome unico, maximo de 3 skills ativas, `exclusive` bloqueia as demais

**Metodos:** `matches(input, context)`, `activate()`, `deactivate()`, `toContextInjection()`

**Eventos Emitidos:** `SkillMatched`, `SkillActivated`

### KnowledgeDocument

**Descricao:** Documento de entrada para o pipeline de knowledge.

**Atributos:** `content`, `metadata`

**Invariantes:** conteudo nao vazio, chunks devem preservar referencia ao documento original

**Metodos:** `chunk(strategy)`, `attachMetadata()`, `toChunks()`

**Eventos Emitidos:** `KnowledgeIngested`, `KnowledgeChunkStored`

### ExecutionContext

**Descricao:** Contexto de rastreio e execucao por chamada.

**Atributos:** `traceId`, `threadId`, `startedAt`, `model`, `parentTraceId?`, `state`

**Invariantes:** novo `traceId` por execucao; subexecucoes herdam `parentTraceId`

**Metodos:** `start()`, `transitionTo()`, `finish()`, `abort()`, `toEventMetadata()`

**Eventos Emitidos:** `ExecutionStarted`, `ExecutionTransitioned`, `ExecutionFinished`

<!-- APPEND:entidades -->

<details>
<summary>Exemplo — Entidade User</summary>

### User

**Descricao:** Representa um usuario do sistema com credenciais e perfil.

**Atributos:**

| Campo | Tipo | Obrigatorio | Validacao | Descricao |
| --- | --- | --- | --- | --- |
| id | UUID | sim | auto-generated | Identificador unico |
| email | string | sim | email valido, unico, max 255 | Email de login |
| name | string | sim | min 2, max 100 | Nome completo |
| passwordHash | string | sim | bcrypt hash | Senha hasheada |
| role | enum | sim | admin, manager, user | Perfil de acesso |
| status | enum | sim | created, active, suspended, inactive | Estado atual |
| createdAt | datetime | sim | auto, imutavel | Data de criacao |
| updatedAt | datetime | sim | auto | Ultima atualizacao |
| deletedAt | datetime | nao | nullable | Soft delete |

**Invariantes:**
- email deve ser unico em todo o sistema
- status so transiciona conforme maquina de estados
- passwordHash nunca e exposto em responses

**Metodos:**

| Metodo | Parametros | Retorno | Descricao |
| --- | --- | --- | --- |
| create() | { email, name, password } | User | Hash da senha, status = created, emite UserCreated |
| activate() | — | void | status → active, emite UserActivated |
| suspend(reason) | string | void | status → suspended, registra motivo |
| deactivate() | — | void | status → inactive, emite UserDeactivated |
| changeEmail(newEmail) | string | void | Valida formato, emite UserEmailChanged |
| changePassword(oldPwd, newPwd) | string, string | void | Verifica old, hash new, emite UserPasswordChanged |

**Eventos:**

| Evento | Quando | Payload |
| --- | --- | --- |
| UserCreated | Apos criacao | { userId, email, name, timestamp } |
| UserActivated | Apos ativacao | { userId, timestamp } |
| UserDeactivated | Apos desativacao | { userId, timestamp } |
| UserEmailChanged | Apos troca | { userId, oldEmail, newEmail, timestamp } |
| UserPasswordChanged | Apos troca de senha | { userId, timestamp } |

</details>

---

## Value Objects

> Quais conceitos sao imutaveis e definidos pelo valor (nao por identidade)?

| Value Object | Campos | Validacao | Usado em |
| --- | --- | --- | --- |
| `TraceId` | `value: string` | UUID valido | `ExecutionContext.traceId` |
| `ThreadId` | `value: string` | nao vazio | Conversas e memories por thread |
| `TokenBudget` | `max`, `reserve`, `used` | numeros nao negativos | `ContextBuilder`, `CostPolicy` |
| `ContextInjection` | `source`, `priority`, `content`, `tokens` | prioridade valida | Skills, knowledge e memory |
| `EmbeddingVector` | `values: Float32Array` | dimensao > 0 | Memory e Knowledge |

<!-- APPEND:value-objects -->

---

## Regras de Negocio

> Quais regras de negocio governam o sistema? Cada regra tem ID para rastreabilidade.

| ID | Regra | Severidade | Entidade | Onde Validar |
| --- | --- | --- | --- | --- |
| RN-01 | CostPolicy deve ser verificada antes de cada chamada ao LLM | Alta | Agent / ReactLoop | Core |
| RN-02 | Tool args sempre passam por validacao Zod antes da execucao | Alta | AgentTool | Tools |
| RN-03 | Mensagens pinadas nao podem ser compactadas | Alta | ChatMessage | Core |
| RN-04 | Memory thread-scoped nao pode vazar para outra thread | Alta | Memory | Domain + store |
| RN-05 | `onToolError` define continue/stop/retry sem comportamento implicito | Alta | ReactLoopExecution | Core |
| RN-06 | MCP desconectado remove tools ate reconexao | Media | MCPConnection | Tools |

<!-- APPEND:regras -->

---

## Relacionamentos

> Como as entidades se relacionam entre si?

| Entidade A | Cardinalidade | Entidade B | Cascade | Obrigatorio | Descricao |
| --- | --- | --- | --- | --- | --- |
| Agent | 1:1 | ExecutionContext | N/A | sim | Cada execucao gera um contexto |
| Agent | 1:N | ChatMessage | append-only | sim | Historico por thread |
| Agent | 0:N | AgentTool | remove on unregister | nao | Tools registradas dinamicamente |
| Agent | 0:N | AgentSkill | remove on unregister | nao | Skills disponiveis |
| Memory | N:1 | ThreadId | remove on thread clear | nao | Scope `thread` |
| KnowledgeDocument | 1:N | KnowledgeChunk | cascade logical | sim | Chunks derivados do documento |

<!-- APPEND:relacionamentos -->

---

## Maquinas de Estado

> Quais entidades possuem ciclo de vida com estados e transicoes?

### ReactLoopExecution — Estados

```text
[idle] -> execute() -> [streaming]
[streaming] -> tool_calls -> [executing_tools]
[streaming] -> stop -> [completed]
[streaming] -> fatal_error -> [error]
[streaming] -> cost_limit -> [cost_limited]
[streaming] -> abort -> [aborted]
[executing_tools] -> continue -> [streaming]
```

**Transicoes:**

| De | Evento/Acao | Para | Regra | Side-effect |
| --- | --- | --- | --- | --- |
| idle | `execute()` | streaming | contexto valido e budget disponivel | emite `turn_start` |
| streaming | tool calls recebidas | executing_tools | `finish_reason=tool_calls` | emite `tool_call_start` |
| streaming | texto final | completed | `finish_reason=stop` | emite `text_done` e `agent_end` |
| streaming | retries esgotados | error | falha OpenRouter | emite `error` |
| streaming | budget excedido | cost_limited | `onLimitReached=stop` | emite `agent_end reason=cost_limit` |
| executing_tools | tools concluidas | streaming | iteracao < limite | adiciona `tool_result` ao historico |
| executing_tools | abort | aborted | `signal.aborted=true` | cleanup |

**Estados terminais:**
- `completed`
- `error`
- `cost_limited`
- `aborted`

**Transicoes proibidas:**
- qualquer estado terminal para outro estado
- `idle -> completed`
- `executing_tools -> cost_limited`

### Memory — Estados

Estados e transicoes conforme blueprint: `active`, `reinforced`, `decaying`, `consolidated`, `expired`, `removed`, implementados pelos metodos `reinforce()`, `applyDecay()`, `markExpired()` e `consolidateWith()`.

### MCPConnection — Estados

Estados e transicoes conforme blueprint: `disconnected`, `connecting`, `connected`, `error`, `reconnecting`, controlados por `connect()`, `handleHeartbeatFailure()`, `scheduleReconnect()` e `disconnect()`.

<!-- APPEND:maquinas -->

> (ver [04-data-layer.md](04-data-layer.md) para schema de banco e repositories)
