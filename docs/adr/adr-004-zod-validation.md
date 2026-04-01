# ADR-004: Zod como único sistema de validação/schema

**Data:** 2026-04-01

**Status:** Aceita

---

## Contexto

O sistema precisa validar configurações (AgentConfig), argumentos de tools e schemas de API. Tools usam schemas para function calling que precisam ser convertidos para JSON Schema.

---

## Drivers de Decisão

- Consistência (um único sistema de schema em todo o pacote)
- TypeScript-first (inferência de tipos)
- Conversão para JSON Schema (function calling)

---

## Opções Consideradas

### Opção A: Zod + zod-to-json-schema

| Aspecto | Avaliação |
|---------|-----------|
| Prós | TypeScript-first, inferência de tipos, API ergonômica, ecossistema amplo, conversão JSON Schema pronta |
| Contras | Runtime validation (não compile-time) |
| Esforço | Baixo |
| Risco | Baixo |

### Opção B: TypeBox + AJV (usado pelo pi-agent-core)

| Aspecto | Avaliação |
|---------|-----------|
| Prós | JSON Schema nativo, validação muito rápida (AJV) |
| Contras | API menos ergonômica, dependências extras, incompatível com Zod usado no resto do projeto |
| Esforço | Médio |
| Risco | Médio (dois sistemas de schema coexistindo) |

### Opção C: io-ts / Joi

| Aspecto | Avaliação |
|---------|-----------|
| Prós | Alternativas maduras |
| Contras | Menos populares, conversão JSON Schema não trivial, equipe sem experiência |
| Esforço | Médio |
| Risco | Médio |

---

## Decisão

**Escolhemos a Opção A: Zod** porque é o padrão do projeto (regra do CLAUDE.md), oferece a melhor DX com TypeScript e `zod-to-json-schema` resolve a conversão para function calling sem esforço.

---

## Consequências

### Positivas

- Um único sistema de schema para config, tools, responses
- Inferência automática de tipos TypeScript (`z.infer<typeof schema>`)
- Consumidores definem tools com API familiar (`z.object({...})`)

### Negativas

- Validação em runtime (não compile-time) — aceitável para o caso de uso

### Riscos

- Nenhum significativo — Zod é a lib de validação mais popular do ecossistema TypeScript
