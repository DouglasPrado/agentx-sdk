# Questões em Aberto

---

| ID | Questão | Impacto | Owner | Prazo |
| -- | ------- | ------- | ----- | ----- |
| Q-01 | Qual modelo usar como default para memory extraction (`extractionModel`)? Modelo barato (gpt-4o-mini) ou o mesmo modelo principal? | Custo vs qualidade de extração de memórias | Engenharia | Fase 2 |
| Q-02 | Limite de 100K vetores no SQLiteVectorStore é suficiente para os casos de uso iniciais? Precisamos de benchmark real? | Performance de RAG em produção | Engenharia | Fase 2 |
| Q-03 | Estratégia de versionamento de schema do SQLite quando o pacote evolui — migrations automáticas ou manual? | UX do consumidor ao atualizar versão do pacote | Engenharia | Fase 1 |
| Q-04 | `@modelcontextprotocol/sdk` deve ser `peerDependency` ou `optionalDependency`? | DX do consumidor que não usa MCP | Engenharia | Fase 2 |
| Q-05 | Como lidar com modelos que não suportam `responseFormat` (structured output)? Fallback para prompt-based? | Compatibilidade com modelos via OpenRouter | Engenharia | Fase 3 |
| Q-06 | Consolidação de memórias similares (dedup semântica) — threshold de similaridade para merge? | Qualidade da memória de longo prazo | Engenharia | Fase 2 |
| Q-07 | Rate limiting interno (`RateLimiter`) deve ser por instância de Agent ou global (todas as instâncias)? | Controle de custo em cenários multi-agent | Engenharia | Fase 3 |

<!-- APPEND:open-questions -->
