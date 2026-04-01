# Validacao

Define as regras de validacao por campo, validacoes cross-field, schemas e mensagens de erro.

---

## Estrategia de Validacao

> Em quais camadas a validacao acontece?

<!-- do blueprint: 00-context.md, 04-domain-model.md, 13-security.md -->
| Camada | O que Valida | Ferramenta | Exemplo |
| --- | --- | --- | --- |
| Public API | formato de `AgentConfig`, `ChatOptions`, `KnowledgeDocumentInput` | Zod | `apiKey` obrigatoria |
| Tools | args de tool e validacao semantica opcional | Zod + `tool.validate()` | schema + contexto |
| Domain | invariantes e estados | metodos das entidades | transicao de memory state |
| Infrastructure | constraints SQLite e serializacao | prepared statements + checks | `NOT NULL`, enums persistidos |

---

## Regras por Entidade

> Para CADA campo que recebe input, documente tipo, regras e mensagem.

### AgentConfig

| Campo | Tipo | Regras | Mensagem de Erro |
| --- | --- | --- | --- |
| `apiKey` | string | required, trim, min(1) | `API key obrigatoria` |
| `model` | string | required, trim | `Modelo obrigatorio` |
| `tools` | array | unique by name | `Tool duplicada` |
| `costPolicy.maxTokensPerExecution` | number | positive integer | `Limite por execucao invalido` |
| `costPolicy.maxTokensPerSession` | number | positive integer | `Limite por sessao invalido` |
| `memory` | object/bool | coerencia de flags | `Config de memory invalida` |

### ChatOptions

| Campo | Tipo | Regras | Mensagem de Erro |
| --- | --- | --- | --- |
| `threadId` | string | optional, trim, min(1) | `threadId invalido` |
| `temperature` | number | optional, 0-2 | `temperature fora do intervalo` |
| `responseFormat` | object | tipo suportado | `responseFormat invalido` |

### Memory

| Campo | Tipo | Regras | Mensagem de Erro |
| --- | --- | --- | --- |
| `content` | string | required, trim, min(1) | `Memoria vazia` |
| `scope` | enum | thread/persistent/learned | `Escopo invalido` |
| `confidence` | number | 0-1 | `Confidence invalida` |
| `threadId` | string | required if scope=thread | `threadId obrigatorio para scope thread` |

<!-- APPEND:regras -->

### Schema Zod — AgentConfig

```typescript
const AgentConfigSchema = z.object({
  apiKey: z.string().trim().min(1, 'API key obrigatoria'),
  model: z.string().trim().min(1, 'Modelo obrigatorio'),
  costPolicy: z.object({
    maxTokensPerExecution: z.number().int().positive().optional(),
    maxTokensPerSession: z.number().int().positive().optional(),
    maxToolCallsPerExecution: z.number().int().positive().optional(),
    onLimitReached: z.enum(['stop', 'warn']).default('stop'),
  }).optional(),
})
```

---

## Validacoes Cross-Field

> Quais validacoes dependem de multiplos campos?

| Regra | Campos | Logica | Mensagem |
| --- | --- | --- | --- |
| Scope de memoria coerente | `scope`, `threadId` | se `scope=thread`, `threadId` e obrigatorio | `threadId obrigatorio para scope thread` |
| Determinismo | `deterministic`, `temperature`, `seed` | modo deterministico zera ou fixa parametros | `Configuracao deterministica invalida` |
| Skill exclusiva | `exclusive`, matches` | se uma exclusiva ativa, bloqueia outras | `Skill exclusiva impede combinacao` |

<!-- APPEND:cross-field -->

---

## Validacoes de Parametros Internos

> Quais validacoes se aplicam a parametros de metodos internos?

| Parametro | Contexto | Tipo | Regras | Mensagem |
| --- | --- | --- | --- | --- |
| `threadId` | `ChatOptions` | string | nao vazio | `threadId invalido` |
| `limit` | busca de memories | number | inteiro positivo | `limit invalido` |
| `topK` | busca vetorial | number | inteiro positivo, max configurado | `topK invalido` |
| `timeout` | MCP config | number | inteiro positivo | `timeout invalido` |

---

## Sanitizacao

> Quais campos sao sanitizados antes de processar?

| Campo | Sanitizacao | Motivo |
| --- | --- | --- |
| `apiKey` | trim, nunca logar | evitar vazios e exposicao |
| `model` | trim | remover espacos acidentais |
| `content` | normalize whitespace opcional | consistencia de embeddings e FTS |
| `metadata` | serializacao JSON segura | evitar objetos nao serializaveis |
| URLs MCP SSE | validar protocolo `https` quando remoto | reduzir risco de configuracao insegura |

> (ver [11-tools-mcp.md](11-tools-mcp.md) para validacao de tools e MCP)
