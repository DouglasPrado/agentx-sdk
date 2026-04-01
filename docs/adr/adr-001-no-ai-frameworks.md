# ADR-001: Não usar frameworks de IA

**Data:** 2026-04-01

**Status:** Aceita

---

## Contexto

O projeto precisa de um agente conversacional com loop ReAct, tool calling, streaming e memory. Existem frameworks que oferecem parte dessas funcionalidades, mas trazem dependências pesadas e abstrações opinativas.

O `@mariozechner/pi-agent-core` (v0.64.0) foi avaliado especificamente e rejeitado.

---

## Drivers de Decisão

- Dependências mínimas (princípio arquitetural #1)
- Controle total sobre cada componente
- Compatibilidade com Zod (proibido TypeBox/AJV)
- 70% das features precisam ser construídas de qualquer forma

---

## Opções Consideradas

### Opção A: pi-agent-core

Agent loop + eventos + tool execution prontos.

| Aspecto | Avaliação |
|---------|-----------|
| Prós | Loop ReAct pronto (~200 linhas), eventos granulares, hooks |
| Contras | Traz OpenAI SDK + Anthropic SDK + Google GenAI SDK + TypeBox + AJV. Schema incompatível (TypeBox vs Zod). Versão 0.x instável de único mantenedor |
| Esforço | Baixo (integração) |
| Risco | Alto (breaking changes, deps pesadas, 70% precisa ser construído anyway) |

### Opção B: LangChain / Vercel AI SDK

Frameworks maduros e populares.

| Aspecto | Avaliação |
|---------|-----------|
| Prós | Comunidade grande, muitas integrações prontas |
| Contras | Dezenas de dependências transitivas, abstrações complexas, lock-in em patterns do framework |
| Esforço | Médio (adaptação) |
| Risco | Alto (bundle size, complexidade, dificuldade de customização) |

### Opção C: Implementação própria com fetch() nativo

Loop ReAct, streaming, tool calling implementados do zero.

| Aspecto | Avaliação |
|---------|-----------|
| Prós | Zero dependências de IA, controle total, Zod nativo, ~200 linhas para o loop |
| Contras | Mais código para escrever e manter |
| Esforço | Médio-Alto (30 arquivos) |
| Risco | Baixo (código simples, sem deps externas instáveis) |

---

## Decisão

**Escolhemos a Opção C: Implementação própria** porque os drivers de dependências mínimas e controle total superam o custo de escrever ~200 linhas de loop ReAct. O pi-agent-core entrega apenas 30% do necessário e cobra 100% das dependências.

---

## Consequências

### Positivas

- ≤ 4 dependências diretas em `dependencies`
- Validação 100% Zod, sem conflito de schemas
- Nenhum risco de breaking changes de frameworks 0.x
- Inspirações aproveitadas (eventos granulares, hooks) sem a dependência

### Negativas

- ~30 arquivos a implementar e manter
- Sem comunidade para suporte — bugs são responsabilidade interna

### Riscos

- Reimplementação de features cobertas por frameworks — **Mitigação:** escopo claro no PRD, apenas features necessárias

---

## Referências

- PRD `docs/prd.md` — seção "Avaliação pi-agent-core"
- Princípio #1: "Dependências mínimas, controle máximo"
