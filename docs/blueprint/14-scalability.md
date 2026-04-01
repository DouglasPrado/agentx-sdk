# 14. Escalabilidade

> Como o sistema crescerá para atender mais dados e mais carga?

> **Nota:** O Pure Agent é uma biblioteca in-process. "Escala" significa: como o Agent se comporta quando o consumidor aumenta o volume de dados, threads concorrentes ou documentos de knowledge.

---

## 14.1 Estratégias de Escala

### Escala Horizontal (do consumidor)

| Aspecto | Detalhes |
|---|---|
| **Componentes elegíveis** | A aplicação host pode rodar múltiplas instâncias Node.js, cada uma com sua própria instância do Agent |
| **Mecanismo de balanceamento** | Responsabilidade da aplicação host (load balancer externo) |
| **Estado da sessão** | Cada instância do Agent tem seu próprio SQLite. Para estado compartilhado, consumidor deve plugar stores externos (PostgreSQL, Redis) |
| **Limite** | SQLite é single-writer — múltiplas instâncias do Agent não devem acessar o mesmo arquivo `.db` simultaneamente |

### Escala Vertical (dentro do processo)

| Aspecto | Detalhes |
|---|---|
| **Threads concorrentes** | Agent suporta threads ilimitadas via ConversationManager. Cada thread tem mutex independente — execuções em threads diferentes rodam em paralelo |
| **Memória do processo** | Cache LRU de embeddings em memória JS. `maxSize` configurável para controlar consumo |
| **CPU** | Busca vetorial brute-force é CPU-bound. Para >100K vetores, migrar para VectorStore plugável |

### Caching

| Aspecto | Detalhes |
|---|---|
| **Tecnologia** | Cache LRU em memória JS (built-in, zero dependências) |
| **Camadas de cache** | EmbeddingService (embeddings por texto) → KnowledgeManager (resultados de busca) → SkillManager (embeddings de descriptions) |
| **Estratégia de invalidação** | TTL-based (configurável por cache). Sem event-driven invalidation |
| **Tamanho estimado** | 10K embeddings (~40MB para dim=1536), 500 resultados de busca (~5MB) |

### Particionamento (Interfaces Plugáveis)

| Aspecto | Detalhes |
|---|---|
| **Estratégia** | Não aplicável ao SQLite padrão. Para cenários de escala, consumidor migra para stores plugáveis |
| **MemoryStore** | Plugar PostgreSQL/Redis para memórias compartilhadas entre instâncias |
| **VectorStore** | Plugar PgVector/Pinecone/Qdrant para busca vetorial escalável |
| **ConversationStore** | Plugar PostgreSQL/Redis para histórico compartilhado |

---

## 14.2 Limites Atuais

| Componente | Limite Atual | Gargalo | Ação quando atingir |
|---|---|---|---|
| SQLiteVectorStore | ~100K vetores | CPU (brute-force cosine) | Plugar VectorStore externo (PgVector, Pinecone) |
| SQLite (file) | 1 writer por arquivo | I/O (WAL mitiga para leitura) | Usar stores plugáveis para multi-instância |
| Busca vetorial | ~50ms para 50K vetores | CPU (cálculo cosseno em JS) | Cache LRU de embeddings; migrar para store com índice vetorial |
| Memórias (FTS5) | 100K+ memórias | I/O (aceitável) | FTS5 escala bem; decay + limpeza mantêm volume controlado |
| Cache LRU (embeddings) | 10K entries (~40MB) | Memória do processo | Ajustar maxSize; se insuficiente, usar cache externo |
| Threads concorrentes | 100+ (testado) | Memória (histórico por thread) | Persistir e descarregar threads inativas |
| Mensagens pinadas | 20 por thread | Design (limite intencional) | Mais antigas perdem pin automaticamente |
| maxToolCallsPerExecution | Configurável (default: 20) | Design (proteção contra loops) | Ajustar conforme necessidade |

<!-- APPEND:capacity-limits -->

---

## 14.3 Plano de Capacidade

| Métrica | Uso Típico | Uso Intensivo | Ação necessária |
|---|---|---|---|
| Vetores em knowledge | < 10K | 50K-100K | Monitorar latência de busca; migrar VectorStore se >100K |
| Memórias persistidas | < 1K | 5K-10K | Decay + limpeza automática mantém volume; ajustar decayFactor |
| Threads ativas | 1-10 | 50-100 | Persistir threads inativas para liberar memória |
| Mensagens por thread | 10-50 | 100-500 | Compactação automática via ContextBuilder |
| Tamanho do arquivo SQLite | < 50MB | 100MB-1GB | Monitorar; vacuum periódico; migrar stores se necessário |
| Embeddings em cache | < 1K | 5K-10K | Ajustar maxSize do cache LRU |

---

## 14.4 Diagrama de Deploy Escalado

> 📐 Diagrama: [production-scaled.mmd](../diagrams/deployment/production-scaled.mmd)

---

## 14.5 Estratégia de Cache

| O que cachear | TTL | Invalidação | maxSize |
|---|---|---|---|
| Embeddings de texto (EmbeddingService) | 1 hora | TTL expiration | 10.000 entries |
| Resultados de busca de knowledge (KnowledgeManager) | 5 minutos | TTL expiration | 500 entries |
| Embeddings de skill descriptions (SkillManager) | 24 horas | TTL expiration (skills raramente mudam) | 100 entries |
| Embeddings carregados do SQLite (SQLiteVectorStore) | Sessão (sem TTL) | Eviction LRU | Configurável |

<!-- APPEND:cache-strategies -->

---

## 14.6 Rate Limiting e Controle de Custo

### Objetivo

Proteger contra consumo descontrolado de tokens (custo financeiro) e loops infinitos de tools.

### Configuração de Limites (CostPolicy)

| Recurso | Limite | Escopo | Ação ao exceder |
|---|---|---|---|
| Tokens por execução | maxTokensPerExecution (configurável) | Por chamada chat()/stream() | `stop`: para execução; `warn`: emite warning |
| Tokens por sessão | maxTokensPerSession (configurável) | Por instância do Agent | Bloqueia novas execuções ou emite warning |
| Tool calls por execução | maxToolCallsPerExecution (default: 20) | Por chamada chat()/stream() | Para o ReactLoop |
| Erros consecutivos | maxConsecutiveErrors (default: 3) | Por execução do ReactLoop | Para o ReactLoop com error event |
| Iterações do loop | maxToolIterations (default: 10) | Por execução do ReactLoop | Para o loop, retorna último texto |
| Timeout | timeout (default: 120s) | Por execução | Aborta via AbortSignal |

### Degradação Graciosa

1. **Nível 1 — Warning**: tokens acumulados > 80% do limite → emite `warning` event
2. **Nível 2 — Compactação**: histórico excede budget → ContextBuilder compacta mensagens antigas
3. **Nível 3 — Corte de injections**: context budget apertado → pipeline corta memory e knowledge (skills preservadas)
4. **Nível 4 — Stop**: CostPolicy atingida → para execução, emite `agent_end` com `reason: 'cost_limit'`
5. **Nível 5 — Session exhausted**: maxTokensPerSession → novas chamadas rejeitadas (criar novo Agent)

---

## Referências

- PRD `docs/prd.md` — limites de vetores, CostPolicy, limites de threads
- ADR-002: SQLite como persistência padrão (limites conhecidos)
- ADR-005: Interfaces plugáveis (estratégia de migração para escala)
