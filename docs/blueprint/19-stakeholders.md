# Stakeholders

---

## Partes Interessadas

| Stakeholder | Área | Interesse | Poder de Decisão | Necessidade de Alinhamento |
| ----------- | ---- | --------- | ---------------- | -------------------------- |
| Desenvolvedor(es) do pacote | Engenharia | Implementar o Pure Agent conforme PRD, garantir qualidade e performance | Alto | Contínuo (daily) |
| Consumidores da lib (devs) | Engenharia (externa) | Usar o Agent em suas aplicações com API simples e estável | Médio — feedback influencia API | Ad hoc (issues, feedback) |
| Tech Lead | Arquitetura | Garantir que decisões técnicas (zero deps, SQLite, OOP) são sustentáveis | Alto | Semanal |

---

## Responsabilidades

| Área | Responsabilidade |
| ---- | ---------------- |
| Engenharia | Implementação das 3 fases, testes, CI, documentação de API |
| Arquitetura | Revisão de decisões (ADRs), validação de interfaces plugáveis, performance |
| QA | Testes manuais dos 9 cenários de verificação do PRD, edge cases |
| Consumidor | Integração, feedback, sandboxing de tools, gerenciamento de API keys |
