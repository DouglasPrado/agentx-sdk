# Estados do Sistema

> Identifique entidades que possuem ciclo de vida — elas mudam de estado ao longo do tempo.

---

## Modelo de Estados

### ReactLoop Execution

**Descrição:** Representa o ciclo de vida de uma execução do loop ReAct, desde o início até a conclusão ou falha. Cada chamada `chat()`/`stream()` cria uma nova execução.

#### Estados Possíveis

| Estado | Descrição |
|--------|-----------|
| idle | ReactLoop criado mas ainda não iniciado |
| streaming | Aguardando/recebendo SSE chunks do OpenRouter |
| executing_tools | Executando tool calls retornadas pelo LLM (parallel ou sequential) |
| completed | Execução finalizada com sucesso — texto final entregue |
| error | Execução interrompida por erro irrecuperável |
| cost_limited | Execução interrompida por CostPolicy |
| aborted | Execução cancelada via AbortSignal |

#### Transições

| De | Para | Gatilho | Condição |
|----|------|---------|----------|
| idle | streaming | `execute()` chamado | messages e tools configurados |
| streaming | executing_tools | LLM retorna tool_calls | finish_reason === 'tool_calls' |
| streaming | completed | LLM retorna texto final | finish_reason === 'stop' |
| streaming | error | OpenRouter falha após retries | maxRetries esgotado |
| streaming | cost_limited | Tokens acumulados > maxTokensPerExecution | onLimitReached === 'stop' |
| streaming | aborted | AbortSignal disparado | signal.aborted === true |
| executing_tools | streaming | Tools executadas, resultados adicionados | iteration < maxIterations |
| executing_tools | error | maxConsecutiveErrors atingido | erros consecutivos >= maxConsecutiveErrors |
| executing_tools | completed | maxIterations atingido | iteration >= maxIterations |
| executing_tools | aborted | AbortSignal disparado | signal.aborted === true |

#### Transições Proibidas

- `completed` → qualquer estado: terminal, execução encerrada
- `error` → qualquer estado: terminal, execução encerrada
- `cost_limited` → qualquer estado: terminal
- `aborted` → qualquer estado: terminal
- `idle` → `completed`: não pode completar sem executar
- `executing_tools` → `cost_limited`: cost check ocorre antes do streaming, não durante tools

#### Diagrama

> 📐 Diagrama: [state-react-loop.mmd](../diagrams/domain/state-react-loop.mmd)

---

### Memory (Ciclo de Vida)

**Descrição:** Representa o ciclo de vida de uma memória desde sua extração até eventual remoção. Confidence decai com o tempo e é reforçada pelo uso.

#### Estados Possíveis

| Estado | Descrição |
|--------|-----------|
| active | Memória com confidence acima do threshold, disponível para recall |
| reinforced | Memória acessada recentemente, confidence reforçada (+0.05 por acesso) |
| decaying | Memória não acessada há N turnos, confidence em decay (×decayFactor) |
| consolidated | Memória mergeada com outra similar (dedup semântica) |
| expired | Confidence caiu abaixo de minConfidence — marcada para remoção |
| removed | Memória deletada do store. Estado terminal |

#### Transições

| De | Para | Gatilho | Condição |
|----|------|---------|----------|
| (criação) | active | MemoryManager.save() | Extração ou remember() explícito |
| active | reinforced | MemoryStore.search() retorna esta memória | access_count incrementado |
| reinforced | active | Nenhum acesso no intervalo | Próximo ciclo de decay |
| active | decaying | decayInterval turnos sem acesso | confidence × decayFactor aplicado |
| decaying | active | MemoryStore.search() retorna esta memória | confidence += 0.05 (reforço) |
| decaying | expired | confidence < minConfidence | Após aplicação de decay |
| active | consolidated | Dedup semântica detecta duplicata | Memórias com similaridade > threshold |
| reinforced | consolidated | Dedup semântica detecta duplicata | Memórias com similaridade > threshold |
| expired | removed | Limpeza automática | Memória removida do SQLite |
| consolidated | removed | Memória original removida após merge | Conteúdo transferido para memória consolidada |

#### Transições Proibidas

- `removed` → qualquer estado: terminal, deletada
- `expired` → `reinforced`: memória expirada não pode ser reforçada, apenas removida
- `consolidated` → `decaying`: memória consolidada é substituída, não decai

#### Diagrama

> 📐 Diagrama: [state-memory.mmd](../diagrams/domain/state-memory.mmd)

---

### MCP Connection

**Descrição:** Representa o ciclo de vida de uma conexão com um servidor MCP externo, incluindo reconexão automática.

#### Estados Possíveis

| Estado | Descrição |
|--------|-----------|
| disconnected | Sem conexão ativa com o server |
| connecting | Estabelecendo conexão (stdio spawn ou HTTP SSE) |
| connected | Conexão ativa, tools registradas no ToolExecutor, health check ativo |
| error | Falha na conexão ou operação — aguardando decisão |
| reconnecting | Reconexão automática em andamento (backoff exponencial) |

#### Transições

| De | Para | Gatilho | Condição |
|----|------|---------|----------|
| disconnected | connecting | `agent.connectMCP(config)` chamado | SDK instalado |
| connecting | connected | Conexão estabelecida + tools listadas | Server respondeu |
| connecting | error | Timeout ou falha de conexão | Após maxRetries tentativas |
| connected | error | Heartbeat falha | Server não responde ao health check |
| connected | disconnected | `agent.disconnectMCP()` chamado | Desconexão intencional |
| error | reconnecting | Reconexão automática iniciada | maxRetries não esgotado |
| reconnecting | connected | Reconexão bem-sucedida | Server respondeu |
| reconnecting | error | Todas as tentativas falharam | maxRetries esgotado |
| error | disconnected | `agent.disconnectMCP()` ou `destroy()` | Cleanup intencional |

#### Transições Proibidas

- `disconnected` → `connected`: deve passar por `connecting`
- `connected` → `connecting`: reconexão passa por `error` → `reconnecting`
- `reconnecting` → `disconnected`: reconexão resulta em `connected` ou `error`

#### Diagrama

> 📐 Diagrama: [state-mcp-connection.mmd](../diagrams/domain/state-mcp-connection.mmd)

---

### Agent Session

**Descrição:** Representa o ciclo de vida da instância do Agent, desde criação até destruição.

#### Estados Possíveis

| Estado | Descrição |
|--------|-----------|
| initializing | Agent sendo construído — validando config, criando subsistemas |
| ready | Agent pronto para receber chamadas `chat()`/`stream()` |
| executing | Uma ou mais execuções ativas (pode ser em threads diferentes) |
| cost_exhausted | maxTokensPerSession atingido — novas chamadas bloqueadas (se onLimitReached: 'stop') |
| destroying | `destroy()` chamado — fechando conexões MCP e SQLite |
| destroyed | Recursos liberados. Estado terminal |

#### Transições

| De | Para | Gatilho | Condição |
|----|------|---------|----------|
| (criação) | initializing | `new Agent(config)` | Config válida (Zod validation) |
| initializing | ready | Subsistemas inicializados | SQLite aberto, MCP conectado (se config) |
| ready | executing | `chat()` ou `stream()` chamado | Dentro dos limites de CostPolicy |
| executing | ready | Todas as execuções finalizadas | Nenhuma execução ativa |
| executing | executing | Nova execução em outra thread | Threads diferentes rodam em paralelo |
| executing | cost_exhausted | maxTokensPerSession atingido | onLimitReached: 'stop' |
| ready | cost_exhausted | maxTokensPerSession atingido durante execução anterior | Verificação no início de nova chamada |
| ready | destroying | `agent.destroy()` chamado | Nenhuma execução ativa |
| executing | destroying | `agent.destroy()` chamado | Execuções em andamento recebem abort |
| cost_exhausted | destroying | `agent.destroy()` chamado | Cleanup de recursos |
| destroying | destroyed | Recursos liberados | MCP desconectado, SQLite fechado |

#### Transições Proibidas

- `destroyed` → qualquer estado: terminal, não pode ser reutilizado
- `cost_exhausted` → `ready`: limite de sessão é permanente (criar novo Agent)
- `initializing` → `executing`: deve estar `ready` primeiro

#### Diagrama

> 📐 Diagrama: [state-agent-session.mmd](../diagrams/domain/state-agent-session.mmd)

<!-- APPEND:state-models -->
