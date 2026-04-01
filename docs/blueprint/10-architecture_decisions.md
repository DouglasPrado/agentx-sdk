# Decisões Arquiteturais

## O que é um ADR?

Um **Architecture Decision Record (ADR)** é um registro curto e objetivo de uma decisão técnica significativa tomada no projeto. ADRs capturam o **contexto** em que a decisão foi tomada, as **opções avaliadas**, a **escolha final** e suas **consequências**.

> Toda decisão técnica significativa que afeta a estrutura do sistema deve ser registrada aqui.

---

## Índice de ADRs

| ADR | Título | Status | Data |
|-----|--------|--------|------|
| [ADR-001](../adr/adr-001-no-ai-frameworks.md) | Não usar frameworks de IA (pi-agent-core, LangChain, Vercel AI SDK) | Aceita | 2026-04-01 |
| [ADR-002](../adr/adr-002-sqlite-persistence.md) | SQLite como persistência padrão (memories, vectors, conversations) | Aceita | 2026-04-01 |
| [ADR-003](../adr/adr-003-openrouter-only.md) | OpenRouter como único gateway de LLM | Aceita | 2026-04-01 |
| [ADR-004](../adr/adr-004-zod-validation.md) | Zod como único sistema de validação/schema | Aceita | 2026-04-01 |
| [ADR-005](../adr/adr-005-pluggable-interfaces.md) | Interfaces plugáveis com implementações SQLite padrão | Aceita | 2026-04-01 |
| [ADR-006](../adr/adr-006-hybrid-memory-search.md) | Busca híbrida de memórias (FTS5 + embeddings + RRF) | Aceita | 2026-04-01 |

<!-- APPEND:adrs -->
