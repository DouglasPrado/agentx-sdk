# Modelo de Dados

Enquanto o [Modelo de Domínio](./04-domain-model.md) descreve entidades e regras de negócio de forma **lógica e conceitual**, o modelo de dados define como essas entidades serão **fisicamente armazenadas**. Aqui tratamos de tabelas, campos, tipos de dados, constraints, índices e estratégias de migração.

> A separação entre domínio e dados permite que decisões de negócio e decisões de infraestrutura evoluam de forma independente.

---

## Banco de Dados

> Qual banco de dados será usado? Relacional ou NoSQL? Justifique a escolha considerando os padrões de leitura/escrita do sistema.

- **Tecnologia:** SQLite (via `better-sqlite3`)
- **Justificativa:** Arquivo único (`~/.agent/data.db`), zero config, sem servidor. WAL mode para leitura concorrente sem locks. FTS5 para busca full-text em memórias. Ideal para persistência local de um pacote standalone. Para volumes acima de 100K vetores, o consumidor pode plugar `PgVectorStore` ou similar via interface `VectorStore`.

---

## Tabelas / Collections

### memories

**Descrição:** Armazena fatos e conhecimentos extraídos de conversas, com ciclo de vida baseado em confidence e decay temporal.

**Campos:**

| Campo | Tipo | Constraint | Descrição |
|-------|------|-----------|-----------|
| id | TEXT | PK | Identificador único (UUID) |
| content | TEXT | NOT NULL | Conteúdo textual da memória |
| scope | TEXT | NOT NULL | Escopo: 'thread' \| 'persistent' \| 'learned' |
| category | TEXT | NOT NULL | Categoria: 'fact' \| 'preference' \| 'procedure' \| 'insight' \| 'context' |
| confidence | REAL | NOT NULL DEFAULT 0.8 | Nível de confiança (0.0-1.0), decai com o tempo |
| access_count | INTEGER | NOT NULL DEFAULT 0 | Contador de acessos para reforço de confidence |
| source | TEXT | NOT NULL DEFAULT 'extracted' | Origem: 'extracted' \| 'explicit' \| 'feedback' |
| thread_id | TEXT | | Thread de origem (obrigatório se scope='thread') |
| embedding | BLOB | | Float32Array serializado para busca semântica |
| created_at | INTEGER | NOT NULL | Timestamp Unix de criação |
| last_accessed_at | INTEGER | NOT NULL | Timestamp Unix do último acesso |

**Índices:**

| Nome do Índice | Campos | Tipo | Justificativa |
|---------------|--------|------|---------------|
| (PK) | id | UNIQUE | Chave primária |
| idx_memories_scope | scope | BTREE | Filtragem frequente por escopo na busca |
| idx_memories_thread | thread_id | BTREE | Busca de memórias por thread específica |
| idx_memories_confidence | confidence | BTREE | Limpeza periódica de memórias com confidence baixo |

---

### memories_fts

**Descrição:** Tabela virtual FTS5 para busca full-text no conteúdo das memórias. Sincronizada automaticamente com a tabela `memories`.

**Campos:**

| Campo | Tipo | Constraint | Descrição |
|-------|------|-----------|-----------|
| content | TEXT | | Conteúdo indexado para full-text search (espelhado de memories) |

> Tabela virtual: `CREATE VIRTUAL TABLE memories_fts USING fts5(content, content=memories, content_rowid=rowid)`

---

### vectors

**Descrição:** Armazena chunks de documentos com seus embeddings para busca vetorial (RAG/Knowledge).

**Campos:**

| Campo | Tipo | Constraint | Descrição |
|-------|------|-----------|-----------|
| id | TEXT | PK | Identificador único (UUID) |
| content | TEXT | NOT NULL | Conteúdo textual do chunk |
| embedding | BLOB | NOT NULL | Float32Array serializado (vetor de embedding) |
| metadata | TEXT | | JSON com metadados do documento original (título, fonte, chunk index) |
| created_at | INTEGER | NOT NULL | Timestamp Unix de criação |

**Índices:**

| Nome do Índice | Campos | Tipo | Justificativa |
|---------------|--------|------|---------------|
| (PK) | id | UNIQUE | Chave primária |

> Nota: Busca vetorial é feita em JS (cosseno sobre todos os embeddings carregados em memória com cache LRU). Não há índice vetorial no SQLite — para >100K vetores, usar VectorStore plugável.

---

### conversations

**Descrição:** Armazena histórico de mensagens por thread, incluindo mensagens do usuário, assistente, sistema e resultados de tools.

**Campos:**

| Campo | Tipo | Constraint | Descrição |
|-------|------|-----------|-----------|
| id | INTEGER | PK AUTOINCREMENT | Identificador sequencial |
| thread_id | TEXT | NOT NULL | Identificador da thread de conversa |
| role | TEXT | NOT NULL | Papel: 'user' \| 'assistant' \| 'system' \| 'tool' |
| content | TEXT | NOT NULL | Conteúdo da mensagem (texto ou JSON para multimodal) |
| tool_calls | TEXT | | JSON com array de tool calls (quando role='assistant') |
| tool_call_id | TEXT | | ID da tool call respondida (quando role='tool') |
| pinned | INTEGER | NOT NULL DEFAULT 0 | 1 = mensagem não compactável pelo ContextBuilder |
| created_at | INTEGER | NOT NULL | Timestamp Unix de criação |

**Índices:**

| Nome do Índice | Campos | Tipo | Justificativa |
|---------------|--------|------|---------------|
| idx_conversations_thread | thread_id, created_at | BTREE composto | Query principal: carregar histórico de uma thread em ordem cronológica |
| idx_conversations_pinned | thread_id, pinned | BTREE composto | Busca rápida de mensagens pinadas por thread |

<!-- APPEND:tables -->

---

## Diagrama ER

> Atualize o diagrama abaixo conforme as tabelas e relacionamentos definidos acima.

> 📐 Diagrama: [er-diagram.mmd](../diagrams/domain/er-diagram.mmd)

---

## Estratégia de Migração

> Como as mudanças no schema serão gerenciadas ao longo do tempo?

- **Ferramenta:** Migrações embutidas no `SQLiteDatabase.initialize()` — versionadas por número sequencial em código TypeScript
- **Convenção de nomes:** Métodos internos `migrateV1()`, `migrateV2()`, etc. executados sequencialmente na inicialização
- **Estratégia de rollback:** SQLite não suporta `ALTER TABLE DROP COLUMN` < 3.35. Rollback via backup do arquivo `.db` antes da migração. Para migrações destrutivas, criar nova tabela + copiar dados + drop old + rename
- **Migrações destrutivas:** Deprecar coluna por 1 versão (mantendo nullable) antes de remover na versão seguinte. Toda migração é idempotente (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`)

---

## Índices e Otimizações

### Queries Críticas

| Descrição da Query | Tabelas Envolvidas | Frequência | SLA Esperado |
|--------------------|--------------------|-----------|-------------|
| Carregar histórico de thread por thread_id (ordenado por created_at) | conversations | Alta (toda chamada chat/stream) | < 5ms |
| Busca full-text em memórias por query do usuário | memories_fts | Alta (todo recall de memory) | < 10ms |
| Busca de memórias por scope e confidence mínimo | memories | Média (extração e decay) | < 5ms |
| Carregar todos os embeddings para busca vetorial | vectors | Alta (toda busca de knowledge) | < 100ms (50K vetores) |
| Listar threads existentes | conversations | Baixa | < 5ms |
| Limpeza de memórias com confidence < threshold | memories | Baixa (periódica, a cada N turnos) | < 50ms |

<!-- APPEND:critical-queries -->

### Diretrizes de Otimização

- WAL mode habilitado por padrão — permite leituras concorrentes sem bloquear escritas
- Cache LRU de embeddings em memória JS — evita I/O repetido para vetores já carregados (TTL: sessão do processo)
- FTS5 para busca textual em memórias — ordens de magnitude mais rápido que LIKE ou regex
- Busca vetorial brute-force em JS aceitável para ≤100K vetores (~50ms para 50K). Acima disso, consumidor deve plugar PgVector/Pinecone
- Prepared statements reutilizados via `better-sqlite3` — evita parsing repetido de SQL
- Transactions para operações batch (ingestão de múltiplos chunks, consolidação de memórias)
- `journal_mode=WAL` + `synchronous=NORMAL` para melhor throughput de escrita sem risco significativo de perda

---

## Referências

- [better-sqlite3 documentation](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md)
- [SQLite FTS5 documentation](https://www.sqlite.org/fts5.html)
- [SQLite WAL mode](https://www.sqlite.org/wal.html)
- PRD: `docs/prd.md` — schemas SQL originais e decisões de design
