# ADR-002: SQLite como persistência padrão

**Data:** 2026-04-01

**Status:** Aceita

---

## Contexto

O sistema precisa persistir memórias, vetores de knowledge e histórico de conversas. Como pacote standalone, não pode exigir que o consumidor configure servidores de banco de dados.

---

## Drivers de Decisão

- Zero config para o consumidor (princípio: simplicidade)
- Dados sobrevivem restart do processo
- FTS5 para busca full-text sem API externa
- WAL mode para leitura concorrente

---

## Opções Consideradas

### Opção A: In-memory (Map/Array)

| Aspecto | Avaliação |
|---------|-----------|
| Prós | Zero dependência, zero I/O, máxima velocidade |
| Contras | Dados perdidos no restart, sem FTS, sem persistência |
| Esforço | Baixo |
| Risco | Alto (perda de dados) |

### Opção B: SQLite via better-sqlite3

| Aspecto | Avaliação |
|---------|-----------|
| Prós | Arquivo único, zero config, FTS5, WAL, prepared statements, `:memory:` para testes |
| Contras | Dependência nativa (compilação), busca vetorial brute-force limitada a ~100K |
| Esforço | Médio |
| Risco | Baixo |

### Opção C: PostgreSQL / Redis

| Aspecto | Avaliação |
|---------|-----------|
| Prós | Escalabilidade, pgvector nativo, Redis para cache |
| Contras | Requer servidor externo, configuração, connection string — viola "zero config" |
| Esforço | Alto |
| Risco | Médio (complexidade operacional) |

---

## Decisão

**Escolhemos a Opção B: SQLite via better-sqlite3** porque oferece persistência real com zero config. Para cenários que excedem as limitações do SQLite (>100K vetores), as interfaces plugáveis (ADR-005) permitem migrar para PostgreSQL/Pinecone sem alterar o core.

---

## Consequências

### Positivas

- Arquivo único `~/.agent/data.db` — consumidor não precisa instalar nada além do npm
- FTS5 para busca full-text em memórias sem custo de API
- WAL mode para leitura concorrente sem locks
- `:memory:` para testes unitários rápidos

### Negativas

- Dependência nativa `better-sqlite3` requer compilação (node-gyp)
- Busca vetorial brute-force O(n) — aceitável para ≤100K, degradada acima

### Riscos

- Compilação nativa pode falhar em ambientes restritos — **Mitigação:** documentar pré-requisitos (build tools)

---

## Referências

- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- [SQLite FTS5](https://www.sqlite.org/fts5.html)
- Modelo de dados: `docs/blueprint/05-data-model.md`
