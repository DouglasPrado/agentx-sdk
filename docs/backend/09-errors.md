# Erros e Excecoes

Define a hierarquia de excecoes, formato padrao de erro, catalogo de codigos e estrategia de tratamento.

---

## Formato Padrao de Erro

> Todo erro emitido pelo pacote segue este formato.

```typescript
interface AppErrorData {
  code: string;                    // UPPER_SNAKE_CASE
  message: string;                 // Segura para exibir ao consumidor
  details?: Array<{ field: string; message: string }>;  // Erros de validacao
  traceId?: string;                // Correlacao com ExecutionContext
}
```

**Regras:**
- `code` e sempre UPPER_SNAKE_CASE
- `message` e sempre segura para exibir ao consumidor
- `details` so aparece em erros de validacao
- `traceId` vem do `ExecutionContext`
- Stack trace NUNCA e exposto em producao

---

## Hierarquia de Excecoes

> Toda excecao herda de AppError. Cada tipo tem uma categoria semantica.

```text
AppError (base)
|- ValidationError
|  |- InvalidConfigError
|  |- InvalidToolArgumentsError
|  |- InvalidResponseFormatError
|- SecurityError
|  |- ToolBlockedError
|  |- MCPToolIsolationError
|- NotFoundError
|  |- ToolNotFoundError
|  |- MCPServerNotFoundError
|- ConflictError
|  |- DuplicateToolNameError
|- BusinessRuleError
|  |- InvalidStateTransitionError
|  |- SessionCostLimitExceededError
|  |- ExecutionCostLimitExceededError
|- ExternalServiceError
|  |- OpenRouterError
|  |- MCPConnectionError
|  |- EmbeddingServiceError
|- TimeoutError
|  |- OpenRouterTimeoutError
|  |- MCPTimeoutError
|- InternalError
   |- SQLiteError
   |- ContextPipelineError
```

<!-- APPEND:hierarquia -->

---

## Catalogo de Codigos de Erro

> Cada codigo e unico e documentado. Frontend usa o `code` para decidir como exibir o erro.

| Codigo | Categoria | Mensagem | Quando | Retentavel |
| --- | --- | --- | --- | --- |
| `INVALID_CONFIG` | Validation | Configuracao invalida do Agent | Zod falhou no config/options | Nao |
| `INVALID_TOOL_ARGUMENTS` | Validation | Argumentos da tool invalidos | Args nao passam no schema | Nao |
| `TOOL_BLOCKED` | Security | Execucao da tool bloqueada | Hook negou a chamada | Nao |
| `TOOL_NOT_FOUND` | NotFound | Tool nao encontrada | Nome nao registrado | Nao |
| `DUPLICATE_TOOL_NAME` | Conflict | Nome de tool ja em uso | Conflito no registro | Nao |
| `INVALID_STATE_TRANSITION` | BusinessRule | Transicao de estado invalida | Mudanca proibida no dominio | Nao |
| `SESSION_COST_LIMIT_EXCEEDED` | BusinessRule | Orcamento da sessao esgotado | maxTokensPerSession | Nao |
| `EXECUTION_COST_LIMIT_EXCEEDED` | BusinessRule | Orcamento da execucao esgotado | maxTokensPerExecution | Nao |
| `OPENROUTER_ERROR` | ExternalService | Falha na comunicacao com OpenRouter | 429/5xx apos retry | Sim |
| `MCP_CONNECTION_ERROR` | ExternalService | Falha na conexao MCP | connect/list/call falhou | Sim |
| `EMBEDDING_FAILED` | ExternalService | Falha ao gerar embedding | OpenRouter embeddings falhou | Sim |
| `OPENROUTER_TIMEOUT` | Timeout | Timeout na chamada ao modelo | tempo limite atingido | Sim |
| `MCP_TIMEOUT` | Timeout | Timeout na comunicacao MCP | operacao MCP excedeu timeout | Sim |
| `SQLITE_ERROR` | Internal | Falha na persistencia local | erro SQLite | Depende |
| `CONTEXT_PIPELINE_ERROR` | Internal | Falha na montagem de contexto | erro no pipeline | Nao |
| `INTERNAL_ERROR` | Internal | Erro interno | excecao nao tratada | Depende |

<!-- APPEND:codigos -->

---

## Estrategia de Tratamento

> Como diferentes tipos de erro sao tratados?

| Tipo de Erro | Onde Tratar | Logar | Alertar | Retry |
| --- | --- | --- | --- | --- |
| Validacao | config/tool validation | Debug | Nao | Nao |
| Negocio | dominio/core | Info | Nao | Nao |
| Externo | OpenRouter/MCP clients | Error | Sim, por taxa | Sim, com backoff |
| Interno | error mapper global | Error + stack | Sim | Depende |

> (ver [10-validation.md](10-validation.md) para regras de validacao por campo e schemas Zod)
