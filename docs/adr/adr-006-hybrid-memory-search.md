# ADR-006: Busca híbrida de memórias (FTS5 + embeddings + RRF)

**Data:** 2026-04-01

**Status:** Aceita

---

## Contexto

O sistema de memória precisa recuperar fatos relevantes de conversas passadas. Busca puramente textual perde semântica ("gosto de café" não encontra "preferência de bebida"). Busca puramente vetorial requer API de embeddings a cada query (custo + latência).

---

## Drivers de Decisão

- Qualidade de recall (encontrar memórias relevantes)
- Custo operacional (minimizar chamadas de API)
- Latência (busca rápida para não bloquear o fluxo)

---

## Opções Consideradas

### Opção A: Apenas FTS5 (full-text search)

| Aspecto | Avaliação |
|---------|-----------|
| Prós | Zero custo de API, < 10ms, sem dependência de embeddings |
| Contras | Perde semântica — busca por keywords, não por significado |
| Esforço | Baixo |
| Risco | Médio (recall baixo para queries semânticas) |

### Opção B: Apenas embeddings (similaridade cosseno)

| Aspecto | Avaliação |
|---------|-----------|
| Prós | Captura semântica, encontra relações não-literais |
| Contras | Requer API de embeddings a cada query (custo + latência), perde matches exatos |
| Esforço | Médio |
| Risco | Médio (custo proporcional ao uso) |

### Opção C: Busca híbrida (FTS5 + embeddings + Reciprocal Rank Fusion)

| Aspecto | Avaliação |
|---------|-----------|
| Prós | Melhor recall que qualquer método isolado, FTS5 garante baseline sem custo, RRF combina rankings |
| Contras | Mais complexo, embeddings opcionais (degradação graciosa) |
| Esforço | Médio |
| Risco | Baixo |

---

## Decisão

**Escolhemos a Opção C: Busca híbrida** porque combina o melhor dos dois mundos. FTS5 garante busca rápida e gratuita como baseline. Quando embeddings estão disponíveis, RRF combina os rankings para melhor recall. Se EmbeddingService não estiver configurado, o sistema degrada graciosamente para FTS5 puro.

---

## Consequências

### Positivas

- Recall superior em cenários semânticos
- Funciona sem embeddings (FTS5 puro) — zero custo mínimo
- Cache de embeddings reduz chamadas de API em 60-80%

### Negativas

- RRF adiciona complexidade ao código de busca
- Dois sistemas de indexação para manter sincronizados

### Riscos

- Resultados de RRF podem ser contra-intuitivos em edge cases — **Mitigação:** ponderação por confidence como fator adicional

---

## Referências

- [Reciprocal Rank Fusion](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf)
- [SQLite FTS5](https://www.sqlite.org/fts5.html)
