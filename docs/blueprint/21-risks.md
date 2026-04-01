# Riscos, Restrições e Assunções

---

## Assunções

| ID | Assunção | Impacto se Falsa |
| -- | -------- | ---------------- |
| A-01 | OpenRouter estará disponível com latência <2s para primeiro token | Sistema inutilizável sem LLM. Mitigação: ModelFallbackChain |
| A-02 | Volume de vetores em knowledge não ultrapassará 100K no uso típico | Degradação de performance na busca vetorial (SQLite). Mitigação: VectorStore plugável |
| A-03 | Consumidor gerencia suas próprias API keys do OpenRouter | Sem API key, nenhuma funcionalidade LLM funciona |
| A-04 | Embeddings serão obtidos via OpenRouter (não há serviço local) | Custo adicional por API call. Mitigação: Cache LRU de embeddings (~60-80% redução) |
| A-05 | Ambiente de execução tem acesso ao filesystem para SQLite | Não funciona em browser/edge. Documentado como requisito |
| A-06 | Node.js 18+ disponível (fetch nativo, dynamic import) | Builds falham em versões anteriores |
| A-07 | Execuções concorrentes na mesma thread são serializadas via mutex | Sem mutex, histórico pode corromper |

---

## Restrições

| ID | Restrição | Fonte |
| -- | --------- | ----- |
| C-01 | Zero frameworks de IA — HTTP via `fetch()` nativo | Decisão arquitetural (PRD) |
| C-02 | Validação exclusivamente via Zod | Decisão arquitetural (CLAUDE.md) |
| C-03 | ≤ 4 dependências diretas | Requisito não-funcional |
| C-04 | 100% independente do dify-agent — nenhum import interno | Requisito de isolamento (PRD) |
| C-05 | Node.js 18+ obrigatório | Runtime requirement (fetch, import()) |
| C-06 | Busca vetorial em SQLite limitada a ~100K vetores com latência aceitável | Limitação técnica do SQLite |
| C-07 | ~30 arquivos no pacote | Decisão de estrutura (PRD) |

---

## Riscos

| ID | Risco | Probabilidade | Impacto | Mitigação | Owner |
| -- | ----- | ------------- | ------- | --------- | ----- |
| R-01 | OpenRouter API instável ou com alta latência | Média | Alto — agente não funciona | ModelFallbackChain + retry com backoff + timeout configurável | Engenharia |
| R-02 | SQLite file locked por processo concorrente | Baixa | Médio — perda de persistência | WAL mode + documentar single-process access | Engenharia |
| R-03 | Memory extraction extrai PII sensível | Média | Médio — dados sensíveis em SQLite local | Consumidor pode desabilitar (`memory: false`) ou `extractionRate: 0` | Consumidor |
| R-04 | Tool maliciosa executada pelo LLM | Baixa | Alto — side effects indesejados | `beforeToolCall` hook + ToolSandbox com timeout e isolamento | Consumidor |
| R-05 | Cost runaway — tokens consumidos sem controle | Média | Alto — fatura inesperada | CostPolicy com maxTokensPerExecution/Session + maxToolCallsPerExecution | Engenharia |
| R-06 | MCP server comprometido injeta dados maliciosos | Baixa | Alto — prompt injection via tool results | Isolamento de falhas, timeout por tool, consumidor valida servers | Consumidor |
| R-07 | Busca vetorial lenta com volume alto | Média | Médio — degradação de RAG | Cache LRU + documentar limite de 100K + VectorStore plugável | Engenharia |
| R-08 | Complexidade do ContextPipeline dificulta debug | Média | Baixo — developer experience | ContextSnapshot + DebugMode com pipeline decisions | Engenharia |
