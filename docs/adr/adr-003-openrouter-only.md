# ADR-003: OpenRouter como único gateway de LLM

**Data:** 2026-04-01

**Status:** Aceita

---

## Contexto

O sistema precisa de acesso a múltiplos LLMs (Claude, GPT, Gemini, etc.) para chat completions, embeddings e structured output. Cada provider tem SDK e API diferentes.

---

## Drivers de Decisão

- Dependências mínimas (sem SDKs de LLM)
- Portabilidade de modelo (trocar via string de config)
- API única para todos os providers

---

## Opções Consideradas

### Opção A: SDKs individuais (OpenAI + Anthropic + Google)

| Aspecto | Avaliação |
|---------|-----------|
| Prós | Acesso direto, features específicas de cada provider |
| Contras | 3+ dependências pesadas, 3 formatos de API, manutenção multiplicada |
| Esforço | Alto |
| Risco | Alto (breaking changes em 3 SDKs) |

### Opção B: OpenRouter como gateway único

| Aspecto | Avaliação |
|---------|-----------|
| Prós | API compatível com OpenAI, `fetch()` nativo basta, troca de modelo via string, embeddings inclusos |
| Contras | Dependência de serviço terceiro, latência extra (~50ms), custo markup |
| Esforço | Baixo |
| Risco | Médio (disponibilidade do OpenRouter) |

### Opção C: Abstração própria multi-provider

| Aspecto | Avaliação |
|---------|-----------|
| Prós | Sem dependência de gateway, acesso direto |
| Contras | Complexidade enorme, manutenção de N adapters, viola princípio de simplicidade |
| Esforço | Muito Alto |
| Risco | Alto |

---

## Decisão

**Escolhemos a Opção B: OpenRouter** porque permite acesso a 100+ modelos via uma única API compatível com OpenAI, usando apenas `fetch()`. Troca de modelo é `model: "anthropic/claude-sonnet-4"` → `model: "openai/gpt-4o"`.

---

## Consequências

### Positivas

- Zero SDKs de LLM nas dependências
- Troca de modelo sem mudança de código
- Streaming SSE, embeddings e structured output via mesma API
- HTTP nativo — sem camada de abstração

### Negativas

- Dependência da disponibilidade e pricing do OpenRouter
- Features provider-specific podem não estar expostas (ex: Anthropic prompt caching)
- Latência extra do proxy (~50ms)

### Riscos

- OpenRouter indisponível — **Mitigação:** `baseUrl` configurável permite apontar para API direta do provider se necessário
