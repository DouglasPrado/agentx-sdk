# Evolução

> Software é um organismo vivo. Planeje como ele vai evoluir.

---

## Roadmap Técnico

> Melhorias planejadas após a implementação inicial (v1.0).

| Item | Prioridade | Justificativa | Fase estimada |
|------|------------|---------------|---------------|
| Suporte a múltiplos providers nativos (sem OpenRouter) | Alta | Reduz dependência de terceiro; permite acesso direto a APIs com features exclusivas (prompt caching Anthropic) | v1.1 |
| Embeddings locais (ONNX Runtime / transformers.js) | Alta | Elimina custo de API para embeddings; permite uso offline | v1.1 |
| Criptografia do arquivo SQLite (SQLCipher ou SEE) | Média | Protege dados em repouso sem depender do consumidor | v1.2 |
| PostgreSQL stores built-in (PgMemoryStore, PgVectorStore, PgConversationStore) | Média | Facilita migração para escala sem que consumidor implemente stores | v1.2 |
| Streaming de tool execution (partial results) | Média | Permite UI mais responsiva durante execuções longas de tools | v1.2 |
| Suporte a image generation (DALL-E, Midjourney via OpenRouter) | Baixa | Amplia casos de uso multimodal | v1.3 |
| WebSocket transport para MCP (além de stdio/SSE) | Baixa | Conectividade mais robusta para MCP servers remotos | v1.3 |
| Plugin system (beyond skills) | Baixa | Permite extensibilidade mais profunda que skills | v2.0 |

<!-- APPEND:technical-roadmap -->

---

## Débitos Técnicos

> Trade-offs aceitos nas decisões iniciais que geram débito.

| Débito | Impacto | Esforço para resolver | Prioridade |
|--------|---------|----------------------|------------|
| Busca vetorial brute-force O(n) no SQLiteVectorStore | Performance degrada com >100K vetores. Limita casos de uso com knowledge grande | Médio — implementar índice aproximado (HNSW) ou integrar pgvector | Alta |
| SQLite sem criptografia em repouso | Dados de conversas e memórias legíveis por qualquer processo com acesso ao filesystem | Médio — integrar SQLCipher como dependência opcional | Alta |
| Sem testes automatizados no MVP | Risco de regressão durante evolução do código | Alto — implementar suite completa conforme estratégia de testes | Alta |
| Token counter é estimativa (não tokenizer real) | Estimativa pode divergir do real em ~10%, causando budget impreciso | Baixo — integrar tiktoken ou gpt-tokenizer como dependência opcional | Média |
| Compactação de histórico depende de chamada LLM | Se modelo de compactação falhar, histórico é truncado perdendo contexto | Baixo — implementar sumarização local com modelo leve | Média |
| Sem rate limiting no OpenRouterClient | Consumidor pode fazer mais requests que o rate limit do OpenRouter | Baixo — implementar token bucket no client | Média |
| Memory consolidation (dedup semântica) não implementada no MVP | Memórias duplicadas acumulam, desperdiçando espaço e poluindo recall | Médio — implementar job periódico de dedup por similaridade | Baixa |
| better-sqlite3 requer compilação nativa (node-gyp) | Pode falhar em ambientes sem build tools | Alto — avaliar alternativa como sql.js (WASM) para fallback | Baixa |

<!-- APPEND:technical-debt -->

### Processo de Gestão de Débitos

- **Registro:** Débitos documentados nesta seção e em issues do repositório com label `tech-debt`
- **Revisão:** A cada release minor (v1.x), revisar e priorizar débitos pendentes
- **Priorização:** Impacto no consumidor × esforço de resolução. Débitos que bloqueiam features do roadmap sobem de prioridade

---

## Estratégia de Versionamento

### Versionamento Semântico (SemVer)

O projeto segue o padrão **MAJOR.MINOR.PATCH**:

- **MAJOR** — mudanças na API pública do Agent (assinatura de chat/stream, formato de AgentEvent, AgentConfig breaking)
- **MINOR** — novas funcionalidades retrocompatíveis (novo tipo de AgentEvent, nova opção em AgentConfig, novo store built-in)
- **PATCH** — correções de bugs, melhorias de performance, atualização de dependências

Versão atual: **0.1.0** (pré-release, API instável até v1.0)

### Versionamento de API (TypeScript)

- **Estratégia:** A API é a interface TypeScript exportada por `index.ts`. Sem versionamento de URL (não é HTTP API)
- **Compatibilidade:** Interfaces plugáveis (`MemoryStore`, `VectorStore`, `ConversationStore`) são consideradas API pública — breaking changes requerem MAJOR bump
- **Política de suporte:** v0.x é instável. A partir de v1.0, releases MAJOR suportam a versão anterior por 6 meses com patches de segurança

---

## Plano de Deprecação

### Processo de Deprecação

1. **Anúncio** — marcar com `@deprecated` JSDoc + nota no CHANGELOG, mínimo 1 release minor antes
2. **Período de transição** — manter funcionalidade deprecated por 1 release minor
3. **Migração** — documentar alternativa no CHANGELOG e na JSDoc
4. **Remoção** — remover na próxima release MAJOR

### Itens em Deprecação

| Funcionalidade | Data de deprecação | Alternativa | Data de remoção |
|------|-------|------|------|
| Nenhum item deprecado atualmente | — | — | — |

<!-- APPEND:deprecations -->

---

## Critérios para Revisão do Blueprint

### Gatilhos de Revisão

Este documento deve ser revisado quando:

- Nova ADR é criada (decisão arquitetural significativa)
- Dependência principal é adicionada ou removida
- Interface plugável é modificada (MemoryStore, VectorStore, ConversationStore)
- Novo subsistema é adicionado ao Agent
- Release MAJOR é planejada
- Incidente revela lacuna na documentação

### Cadência de Revisão

- **Revisão completa:** A cada release MAJOR (v1.0, v2.0, etc.)
- **Revisão parcial (seções impactadas):** A cada release MINOR
- **Responsável pela revisão:** Mantenedor principal do pacote

### Histórico de Revisões

| Data | Autor | Seções alteradas | Motivo |
|------|-------|------------------|--------|
| 2026-04-01 | Blueprint automático | Todas (00-16) | Criação inicial a partir do PRD |

<!-- APPEND:revision-history -->
