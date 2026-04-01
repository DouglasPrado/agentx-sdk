# Data Layer

Define os repositories, schema do ORM, estrategia de migrations, indices criticos e queries de alta performance.

---

## Estrategia de Persistencia

> Quais tecnologias de armazenamento sao usadas e para que?

<!-- do blueprint: 05-data-model.md, 14-scalability.md -->
| Tecnologia | Funcao | Dados | Justificativa |
| --- | --- | --- | --- |
| SQLite (`better-sqlite3`) | Persistencia principal | `memories`, `memories_fts`, `vectors`, `conversations` | Zero config, WAL mode, FTS5 e arquivo unico |
| Cache LRU em memoria | Cache auxiliar | embeddings, resultados de busca, vetores desserializados | Evita I/O e chamadas repetidas ao OpenRouter |
| Filesystem do host | Storage fisico | arquivo `~/.agent/data.db` | Persistencia local simples |

<!-- APPEND:persistencia -->

---

## Repositories

> Para cada entidade, documente os metodos de acesso a dados, queries e indices.

<!-- do blueprint: 04-domain-model.md, 05-data-model.md -->
### ConversationStore

**Responsabilidade:** Persistir e recuperar historico de mensagens por thread.

**Interface:**

| Metodo | Parametros | Retorno | Query Principal |
| --- | --- | --- | --- |
| `appendMessage(message, threadId)` | `ChatMessage, string` | `void` | `INSERT INTO conversations (...) VALUES (...)` |
| `listThread(threadId)` | `string` | `ChatMessage[]` | `SELECT * FROM conversations WHERE thread_id = ? ORDER BY created_at ASC` |
| `listPinned(threadId)` | `string` | `ChatMessage[]` | `SELECT * FROM conversations WHERE thread_id = ? AND pinned = 1` |
| `clearThread(threadId)` | `string` | `void` | `DELETE FROM conversations WHERE thread_id = ?` |

**Indices:** `idx_conversations_thread`, `idx_conversations_pinned`

### MemoryStore

**Responsabilidade:** Persistir memórias, aplicar recall hibrido e suportar decay/cleanup.

**Interface:**

| Metodo | Parametros | Retorno | Query Principal |
| --- | --- | --- | --- |
| `save(memory)` | `Memory` | `Memory` | `INSERT INTO memories (...) VALUES (...)` |
| `search(query, opts)` | `string, SearchOptions` | `Memory[]` | `SELECT rowid, content FROM memories_fts WHERE memories_fts MATCH ?` + rank fusion |
| `findById(id)` | `string` | `Memory | null` | `SELECT * FROM memories WHERE id = ?` |
| `incrementAccess(id)` | `string` | `void` | `UPDATE memories SET access_count = access_count + 1, confidence = MIN(confidence + 0.05, 1), last_accessed_at = ? WHERE id = ?` |
| `deleteLowConfidence(minConfidence)` | `number` | `number` | `DELETE FROM memories WHERE confidence < ?` |
| `listByScope(scope, threadId?)` | `scope, threadId?` | `Memory[]` | `SELECT * FROM memories WHERE scope = ? ...` |

**Indices:** `idx_memories_scope`, `idx_memories_thread`, `idx_memories_confidence`

### VectorStore

**Responsabilidade:** Persistir chunks embedados e executar busca vetorial.

**Interface:**

| Metodo | Parametros | Retorno | Query Principal |
| --- | --- | --- | --- |
| `upsert(chunk)` | `KnowledgeChunk` | `void` | `INSERT OR REPLACE INTO vectors (...) VALUES (...)` |
| `search(queryEmbedding, topK)` | `Float32Array, number` | `RetrievedKnowledge[]` | `SELECT id, content, embedding, metadata FROM vectors` + cosseno em JS |
| `listAll()` | — | `KnowledgeChunk[]` | `SELECT * FROM vectors` |
| `deleteBySource(sourceId)` | `string` | `void` | `DELETE FROM vectors WHERE json_extract(metadata, '$.sourceId') = ?` |

**Indices:** PK em `id`; busca vetorial brute-force sem indice nativo

<!-- APPEND:repositories -->


---

## Schema SQL

> Como as entidades sao representadas no banco?

```sql
CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  scope TEXT NOT NULL,
  category TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.8,
  access_count INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'extracted',
  thread_id TEXT,
  embedding BLOB,
  created_at INTEGER NOT NULL,
  last_accessed_at INTEGER NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
  content,
  content=memories,
  content_rowid=rowid
);

CREATE TABLE IF NOT EXISTS vectors (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  embedding BLOB NOT NULL,
  metadata TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  tool_calls TEXT,
  tool_call_id TEXT,
  pinned INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
```

<!-- APPEND:schema -->

---

## Estrategia de Migrations

> Como as alteracoes de schema sao gerenciadas?

| Aspecto | Decisao |
| --- | --- |
| Ferramenta | Migracoes em codigo no `SQLiteDatabase.initialize()` |
| Convencao de nomes | `migrateV1()`, `migrateV2()` |
| Rollback | Backup do arquivo antes de migracoes destrutivas |
| Ambientes | Dev/Test auto-apply; Prod aplica na inicializacao da instancia host |
| Dados de seed | Nao aplicavel ao pacote |

---

## Queries Criticas

> Quais queries sao executadas com alta frequencia ou exigem performance especifica?

| Descricao | Tabelas | Frequencia | SLA (p95) | Otimizacao |
| --- | --- | --- | --- | --- |
| Carregar historico por thread | `conversations` | toda chamada `chat/stream` | < 5ms | indice composto `thread_id, created_at` |
| Busca full-text em memórias | `memories_fts` | alto | < 10ms | FTS5 |
| Busca por scope/confidence | `memories` | medio | < 5ms | indices BTREE |
| Busca vetorial | `vectors` | alto | < 100ms em 50K vetores | cache LRU + cosseno em JS |

<!-- APPEND:queries -->

---

## Consistencia e Transacoes

> Como transacoes e consistencia sao tratadas?

| Cenario | Tipo | Estrategia |
| --- | --- | --- |
| Ingestao de multiplos chunks | Transacao local | `better-sqlite3` transaction para batch |
| Consolidacao de memorias | Transacao local | update/delete atomico |
| Append de historico + persistencia de resposta final | Transacao local leve | append ordenado por thread |
| Cache + banco | Eventual | cache LRU invalida por TTL ou update |

**Idempotencia:** dedup natural por IDs de memoria/chunk, `eventId` nos eventos internos e replace semantico em `upsert()`.

> (ver [05-api-contracts.md](05-api-contracts.md) para a API publica que consome estes dados)
