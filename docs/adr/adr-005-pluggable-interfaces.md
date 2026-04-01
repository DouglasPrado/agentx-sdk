# ADR-005: Interfaces plugáveis com implementações SQLite padrão

**Data:** 2026-04-01

**Status:** Aceita

---

## Contexto

O sistema precisa funcionar out-of-the-box (zero config) mas também ser extensível para cenários de produção com bancos externos (PostgreSQL, Pinecone, Redis).

---

## Drivers de Decisão

- Zero config para desenvolvimento/prototipagem
- Extensibilidade para produção sem alterar o core
- Testabilidade (mocks via interface)

---

## Opções Consideradas

### Opção A: Implementação concreta única (SQLite hardcoded)

| Aspecto | Avaliação |
|---------|-----------|
| Prós | Simples, menos código, sem abstração |
| Contras | Impossível trocar backend sem refatorar core, difícil de mockar em testes |
| Esforço | Baixo |
| Risco | Alto (lock-in em SQLite) |

### Opção B: Interfaces plugáveis + implementações SQLite padrão

| Aspecto | Avaliação |
|---------|-----------|
| Prós | Zero config com SQLite, extensível via interface, testável com mocks |
| Contras | Abstração adicional (interfaces + implementações) |
| Esforço | Médio |
| Risco | Baixo |

---

## Decisão

**Escolhemos a Opção B** porque resolve ambos os cenários (zero config + extensibilidade) sem comprometer simplicidade. O custo é mínimo (3 interfaces: `MemoryStore`, `VectorStore`, `ConversationStore`).

---

## Consequências

### Positivas

- `new Agent({ memory: true })` funciona imediatamente com SQLite
- `new Agent({ memory: { store: new PgMemoryStore(pool) } })` migra sem tocar no Agent
- Testes unitários mockam interfaces, testes de integração usam SQLite `:memory:`

### Negativas

- Mais arquivos (interface + implementação para cada store)
- Consumidores que criam stores customizados devem implementar todas as operações da interface

### Riscos

- Interface muito ampla pode dificultar implementações — **Mitigação:** interfaces mínimas (save, search, list, delete, update)
