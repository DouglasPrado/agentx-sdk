> **Nota:** Este template é o ponto de entrada para a geração do Blueprint de Software. Preencha-o com o máximo de detalhe possível — cada seção alimenta diretamente as seções correspondentes do blueprint. Seções marcadas com `{{placeholders}}` devem ser substituídas por conteúdo real. Remova os blocos de orientação (citações `>`) após o preenchimento. Quanto mais completo o PRD, mais preciso e útil será o blueprint gerado a partir dele.

---

# PRD-{{ID}}: {{Nome do Produto / Feature}}

**Data:** {{AAAA-MM-DD}}
**Status:** {{Rascunho | Em Revisão | Aprovado | Arquivado}}
**Owner de Produto:** {{nome}}
**Tech Lead:** {{nome}}
**Stakeholders:** {{nomes ou @handles}}
**Versão:** {{v0.1.0}}

---

## 1. Resumo Executivo

> Descreva em 3 a 5 linhas o que está sendo proposto, para quem e qual problema resolve.

{{Resumo claro e objetivo da proposta.}}

---

## 2. Problema

> Qual dor ou necessidade real este produto/feature resolve? Quem sofre com isso hoje? Qual o impacto de não resolver?

### 2.1 Situação atual

{{Descreva como o problema é tratado hoje — processos manuais, soluções alternativas, ferramentas existentes e suas limitações.}}

### 2.2 Evidências

> Dados, métricas, pesquisas ou feedback que comprovam a existência e relevância do problema.

| Fonte | Evidência | Data |
|-------|-----------|------|
| {{Ex.: Pesquisa NPS}} | {{Ex.: 40% dos usuários reportam dificuldade em X}} | {{AAAA-MM-DD}} |
| {{Ex.: Dados de suporte}} | {{Ex.: 120 tickets/mês sobre Y}} | {{AAAA-MM-DD}} |
| {{Ex.: Analytics}} | {{Ex.: 65% de abandono no fluxo Z}} | {{AAAA-MM-DD}} |

### 2.3 Impacto de não resolver

- {{Impacto 1 — ex.: perda de receita estimada em R$ X/mês}}
- {{Impacto 2 — ex.: churn de N% dos clientes do segmento Y}}
- {{Impacto 3 — ex.: custo operacional crescente}}

---

## 3. Visão da Solução

### 3.1 Elevator Pitch

Para {{público-alvo}} que {{necessidade ou problema enfrentado}}, o {{nome do produto/feature}} é {{categoria}} que {{benefício principal}}. Diferente de {{alternativa atual}}, nossa solução {{diferencial}}.

### 3.2 Solução proposta

> Descreva a solução de forma clara e objetiva, sem entrar em detalhes técnicos de implementação.

{{Explicação da solução do ponto de vista do usuário e do negócio.}}

### 3.3 Princípios de design

> Quais princípios devem guiar as decisões de produto durante a construção?

- {{Princípio 1 — ex.: simplicidade acima de completude}}
- {{Princípio 2 — ex.: self-service antes de suporte humano}}
- {{Princípio 3 — ex.: dados abertos, não opinativos}}

---

## 4. Usuários e Personas

> Quem são os usuários diretos e indiretos desta solução?

### 4.1 Personas

| Persona | Perfil | Necessidade principal | Frequência de uso | Nível técnico |
|---------|--------|----------------------|-------------------|---------------|
| {{Persona 1}} | {{Descrição do perfil}} | {{O que precisa resolver}} | {{Diário / Semanal / Mensal}} | {{Baixo / Médio / Alto}} |
| {{Persona 2}} | {{Descrição do perfil}} | {{O que precisa resolver}} | {{Diário / Semanal / Mensal}} | {{Baixo / Médio / Alto}} |

### 4.2 Jobs to Be Done

> Quais "trabalhos" o usuário está tentando realizar?

| Persona | Job | Resultado esperado |
|---------|-----|--------------------|
| {{Persona 1}} | Quando {{situação}}, eu quero {{ação}}, para que {{resultado}} | {{Como o usuário sabe que teve sucesso}} |
| {{Persona 2}} | Quando {{situação}}, eu quero {{ação}}, para que {{resultado}} | {{Como o usuário sabe que teve sucesso}} |

### 4.3 Jornada atual do usuário

> Descreva os passos que o usuário realiza hoje para resolver o problema.

1. {{Passo 1 — ex.: usuário acessa planilha compartilhada}}
2. {{Passo 2 — ex.: busca manualmente o registro}}
3. {{Passo 3 — ex.: copia dados para outro sistema}}
4. {{Passo N — ex.: aguarda confirmação por e-mail}}

**Pontos de dor na jornada atual:**

- {{Dor 1 — etapa X é lenta e propensa a erros}}
- {{Dor 2 — não há visibilidade do status em Y}}

---

## 5. Objetivos e Métricas de Sucesso

### 5.1 Objetivos

| ID | Objetivo | Prioridade | Alinhamento estratégico |
|----|----------|------------|------------------------|
| OBJ-01 | {{Objetivo específico e mensurável}} | Alta | {{OKR, meta do time, estratégia da empresa}} |
| OBJ-02 | {{Objetivo específico e mensurável}} | Média | {{OKR, meta do time, estratégia da empresa}} |

### 5.2 Métricas de sucesso (KPIs)

| Métrica | Linha de base | Meta | Prazo | Como medir |
|---------|---------------|------|-------|------------|
| {{Ex.: Tempo médio de conclusão do fluxo}} | {{Ex.: 15 min}} | {{Ex.: 2 min}} | {{Ex.: 3 meses após lançamento}} | {{Ex.: Analytics de produto}} |
| {{Ex.: Taxa de adoção}} | {{Ex.: 0%}} | {{Ex.: 80% dos usuários-alvo}} | {{Ex.: 6 meses}} | {{Ex.: Telemetria}} |
| {{Ex.: NPS do fluxo}} | {{Ex.: 25}} | {{Ex.: 50+}} | {{Ex.: 6 meses}} | {{Ex.: Pesquisa in-app}} |
| {{Ex.: Tickets de suporte}} | {{Ex.: 120/mês}} | {{Ex.: < 20/mês}} | {{Ex.: 3 meses}} | {{Ex.: Zendesk}} |

### 5.3 Critérios de sucesso mínimo (guardrails)

> Métricas que NÃO podem piorar com o lançamento.

- {{Ex.: Taxa de conversão do funil principal não deve cair abaixo de X%}}
- {{Ex.: Tempo de resposta da API não deve exceder Y ms no p95}}
- {{Ex.: Disponibilidade do serviço não deve cair abaixo de Z%}}

---

## 6. Não-objetivos

> O que este produto/feature deliberadamente NÃO faz? Definir explicitamente evita expansão de escopo.

- {{Não-objetivo 1 — ex.: não substitui o sistema legado X nesta fase}}
- {{Não-objetivo 2 — ex.: não atende o segmento de usuários Y}}
- {{Não-objetivo 3 — ex.: não resolve o problema Z, que será tratado em iniciativa separada}}

---

## 7. Requisitos Funcionais

### 7.1 Capacidades

> Liste as capacidades que a solução deve oferecer, agrupadas por área funcional.

#### {{Área funcional 1 — ex.: Gestão de Conteúdo}}

| ID | Requisito | Prioridade | Critério de aceitação |
|----|-----------|------------|----------------------|
| RF-001 | {{Descrição do requisito}} | Must | {{Critério objetivo e verificável}} |
| RF-002 | {{Descrição do requisito}} | Must | {{Critério objetivo e verificável}} |

#### {{Área funcional 2 — ex.: Notificações}}

| ID | Requisito | Prioridade | Critério de aceitação |
|----|-----------|------------|----------------------|
| RF-003 | {{Descrição do requisito}} | Should | {{Critério objetivo e verificável}} |
| RF-004 | {{Descrição do requisito}} | Could | {{Critério objetivo e verificável}} |

### 7.2 Priorização (MoSCoW)

| Prioridade | Requisitos |
|------------|-----------|
| **Must have** | {{RF-001, RF-002 — essenciais para o MVP}} |
| **Should have** | {{RF-003 — importante mas não bloqueia lançamento}} |
| **Could have** | {{RF-004 — desejável se houver tempo}} |
| **Won't have (this time)** | {{Funcionalidades explicitamente adiadas}} |

---

## 8. Requisitos Não Funcionais

| ID | Categoria | Requisito | Meta | Como medir |
|----|-----------|-----------|------|------------|
| RNF-001 | Performance | {{Ex.: Tempo de resposta da API}} | {{Ex.: p95 < 300ms}} | {{Ex.: APM / New Relic}} |
| RNF-002 | Disponibilidade | {{Ex.: Uptime do serviço}} | {{Ex.: 99.9%}} | {{Ex.: Monitoramento}} |
| RNF-003 | Escalabilidade | {{Ex.: Usuários simultâneos}} | {{Ex.: 10.000}} | {{Ex.: Load test}} |
| RNF-004 | Segurança | {{Ex.: Dados sensíveis criptografados}} | {{Ex.: AES-256 at rest}} | {{Ex.: Auditoria}} |
| RNF-005 | Acessibilidade | {{Ex.: Conformidade WCAG}} | {{Ex.: Nível AA}} | {{Ex.: Lighthouse}} |
| RNF-006 | Compatibilidade | {{Ex.: Browsers suportados}} | {{Ex.: Chrome, Firefox, Safari últimas 2 versões}} | {{Ex.: Testes cross-browser}} |

---

## 9. User Stories e Cenários

### 9.1 User Stories

| ID | Persona | Story | Critério de aceitação |
|----|---------|-------|-----------------------|
| US-001 | {{Persona}} | Como {{persona}}, eu quero {{ação}}, para que {{benefício}} | {{Critério verificável}} |
| US-002 | {{Persona}} | Como {{persona}}, eu quero {{ação}}, para que {{benefício}} | {{Critério verificável}} |

### 9.2 Cenários detalhados

#### Cenário: {{Nome do cenário}}

**Contexto:** {{Situação inicial}}

**Fluxo principal:**

1. {{Passo 1}}
2. {{Passo 2}}
3. {{Passo 3}}

**Resultado esperado:** {{O que acontece ao final}}

**Fluxos alternativos:**

- {{Alternativa A — quando X acontece, então Y}}
- {{Alternativa B — quando W acontece, então Z}}

**Cenários de erro:**

- {{Erro 1 — quando a validação falha, o sistema exibe mensagem clara}}
- {{Erro 2 — quando a dependência está indisponível, o sistema degrada graciosamente}}

---

## 10. Escopo e Fases de Entrega

### 10.1 Escopo funcional

**Incluído nesta iniciativa:**

- {{Capacidade 1}}
- {{Capacidade 2}}
- {{Capacidade 3}}

**Explicitamente excluído:**

- {{Exclusão 1 — será tratado em entrega futura}}
- {{Exclusão 2 — pertence a outro time/projeto}}

### 10.2 Entregas priorizadas

| ID | Nome | Prioridade | Objetivo | Entregáveis | Dependências |
|----|------|-----------|----------|-------------|--------------|
| ENT-001 | Fundação | Must | {{Infraestrutura e contratos}} | {{Lista de entregáveis}} | {{Nenhuma}} |
| ENT-002 | MVP | Must | {{Fluxo principal funcionando}} | {{Lista de entregáveis}} | {{ENT-001}} |
| ENT-003 | Evolução | Should | {{Features complementares}} | {{Lista de entregáveis}} | {{ENT-002}} |
| ENT-004 | Escala | Could | {{Otimização e expansão}} | {{Lista de entregáveis}} | {{ENT-002}} |

### 10.3 MVP — Definição mínima

> Qual é o menor conjunto de funcionalidades que entrega valor real ao usuário?

- {{Funcionalidade 1 — essencial}}
- {{Funcionalidade 2 — essencial}}
- {{Funcionalidade 3 — essencial}}

**O que NÃO está no MVP:**

- {{Funcionalidade adiada 1}}
- {{Funcionalidade adiada 2}}

---

## 11. Design e Experiência do Usuário

### 11.1 Fluxo principal do usuário

> Descreva o fluxo ideal do ponto de vista do usuário após a solução estar pronta.

1. {{Passo 1 — ex.: usuário acessa o dashboard}}
2. {{Passo 2 — ex.: seleciona a ação desejada}}
3. {{Passo 3 — ex.: preenche os dados necessários}}
4. {{Passo 4 — ex.: confirma e recebe feedback imediato}}
5. {{Passo N — ex.: acompanha o progresso em tempo real}}

### 11.2 Wireframes / Mockups

> Referencie ou anexe wireframes, mockups ou protótipos.

- {{Link para Figma / protótipo}}
- {{Link para wireframes}}

### 11.3 Requisitos de UX

- {{Ex.: Fluxo principal deve ser completado em no máximo 3 cliques}}
- {{Ex.: Feedback visual para toda ação do usuário em < 200ms}}
- {{Ex.: Estados de loading, vazio, erro e sucesso para todas as telas}}
- {{Ex.: Responsivo para mobile e desktop}}

---

## 12. Dependências

### 12.1 Dependências internas

| Dependência | Time responsável | O que precisa | Status | Impacto se atrasar |
|-------------|-----------------|---------------|--------|---------------------|
| {{Dependência 1}} | {{Time}} | {{API, serviço, componente}} | {{Resolvida / Pendente / Em risco}} | {{Bloqueia ENT-XXX}} |

### 12.2 Dependências externas

| Dependência | Fornecedor | O que precisa | SLA | Alternativa |
|-------------|-----------|---------------|-----|-------------|
| {{Dependência 1}} | {{Ex.: Stripe}} | {{API de pagamento}} | {{99.9%}} | {{Plano B}} |

### 12.3 Dependências técnicas

- {{Ex.: migração do banco X precisa estar concluída antes da ENT-002}}
- {{Ex.: SDK do parceiro Y precisa ser homologada}}
- {{Ex.: Feature flag infrastructure precisa estar disponível}}

---

## 13. Riscos e Mitigações

| ID | Risco | Probabilidade | Impacto | Mitigação | Owner | Status |
|----|-------|---------------|---------|-----------|-------|--------|
| R-01 | {{Descrição do risco}} | {{Alta / Média / Baixa}} | {{Alto / Médio / Baixo}} | {{Estratégia de mitigação}} | {{Responsável}} | {{Aberto / Mitigado / Aceito}} |
| R-02 | {{Descrição do risco}} | {{Alta / Média / Baixa}} | {{Alto / Médio / Baixo}} | {{Estratégia de mitigação}} | {{Responsável}} | {{Aberto / Mitigado / Aceito}} |

---

## 14. Hipóteses e Validações

> Quais hipóteses precisam ser verdadeiras para esta solução fazer sentido? Como validá-las?

| ID | Hipótese | Como validar | Resultado esperado | Status |
|----|----------|--------------|-------------------|--------|
| H-01 | {{Ex.: Usuários preferem self-service a suporte humano}} | {{Ex.: Teste A/B, pesquisa}} | {{Ex.: > 60% preferem self-service}} | {{Validada / Pendente / Invalidada}} |
| H-02 | {{Ex.: Volume de dados não excederá X GB/mês no primeiro ano}} | {{Ex.: Projeção baseada em dados atuais}} | {{Ex.: Projeção < X GB/mês}} | {{Validada / Pendente / Invalidada}} |

---

## 15. Restrições e Premissas

### 15.1 Restrições

| Tipo | Descrição | Origem |
|------|-----------|--------|
| Técnica | {{Ex.: deve usar a stack existente (Go + PostgreSQL)}} | {{Decisão arquitetural}} |
| Negócio | {{Ex.: orçamento limitado a R$ X}} | {{Finance}} |
| Regulatória | {{Ex.: conformidade LGPD obrigatória}} | {{Legal}} |
| Temporal | {{Ex.: lançamento obrigatório até AAAA-MM-DD}} | {{Compromisso comercial}} |

### 15.2 Premissas

- {{Premissa 1 — ex.: o time terá 3 engenheiros dedicados durante todo o projeto}}
- {{Premissa 2 — ex.: a API do parceiro X estará estável até a data Y}}
- {{Premissa 3 — ex.: o volume de usuários não excederá N no primeiro trimestre}}

> Se alguma premissa se provar falsa, quais decisões precisariam ser revisitadas?

---

## 16. Considerações de Segurança e Privacidade

### 16.1 Dados manipulados

| Tipo de dado | Classificação | Controles necessários |
|-------------|---------------|----------------------|
| {{Ex.: e-mail do usuário}} | PII | {{Criptografia, acesso restrito, retenção limitada}} |
| {{Ex.: token de pagamento}} | Sensível | {{Tokenização, não armazenar, PCI-DSS}} |
| {{Ex.: logs de acesso}} | Interno | {{Retenção de 90 dias, sem PII}} |

### 16.2 Requisitos de compliance

- {{Ex.: LGPD — consentimento explícito para coleta de dados}}
- {{Ex.: SOC 2 — trilha de auditoria para todas as operações}}
- {{Ex.: direito ao esquecimento — exclusão completa em até 30 dias}}

### 16.3 Considerações de segurança

- {{Ex.: autenticação obrigatória para todos os endpoints}}
- {{Ex.: rate limiting para proteção contra abuso}}
- {{Ex.: validação de input em todas as interfaces}}

---

## 17. Plano de Lançamento

### 17.1 Estratégia de rollout

| Etapa | Público | Critério de avanço | Rollback |
|-------|---------|--------------------|---------:|
| Alpha | {{Ex.: time interno}} | {{Ex.: zero bugs críticos por 1 semana}} | {{Estratégia}} |
| Beta | {{Ex.: 10% dos usuários}} | {{Ex.: métricas dentro do esperado}} | {{Estratégia}} |
| GA | {{Ex.: 100% dos usuários}} | {{Ex.: KPIs atingidos}} | {{Estratégia}} |

### 17.2 Comunicação

| Público | Canal | Mensagem | Responsável | Quando |
|---------|-------|----------|-------------|--------|
| {{Usuários}} | {{Ex.: e-mail, in-app}} | {{Resumo da mudança}} | {{Marketing / Produto}} | {{Data}} |
| {{Suporte}} | {{Ex.: Slack, treinamento}} | {{FAQ, runbook}} | {{Produto}} | {{Antes do lançamento}} |
| {{Stakeholders}} | {{Ex.: apresentação}} | {{Resultados e métricas}} | {{PM}} | {{Pós-lançamento}} |

### 17.3 Critérios de go / no-go

**Go:**

- [ ] Testes de aceitação passando
- [ ] Performance validada em staging
- [ ] Documentação de suporte pronta
- [ ] Monitoramento e alertas configurados
- [ ] Plano de rollback testado

**No-go (bloqueia lançamento):**

- [ ] Bug crítico aberto em fluxo principal
- [ ] Performance abaixo do threshold definido
- [ ] Falha em requisito de segurança ou compliance

---

## 18. Suporte e Operações

### 18.1 Impacto em suporte

- {{Ex.: N novos tipos de chamado esperados}}
- {{Ex.: necessidade de treinamento do time de suporte}}
- {{Ex.: FAQ e documentação de ajuda}}

### 18.2 Monitoramento pós-lançamento

| O que monitorar | Ferramenta | Threshold de alerta | Ação |
|-----------------|-----------|---------------------|------|
| {{Ex.: Taxa de erro}} | {{Ex.: Datadog}} | {{Ex.: > 1%}} | {{Acionar on-call}} |
| {{Ex.: Adoção}} | {{Ex.: Amplitude}} | {{Ex.: < 20% em 2 semanas}} | {{Investigar bloqueios}} |

---

## 19. Questões em Aberto

| ID | Questão | Impacto | Owner | Prazo | Status |
|----|---------|---------|-------|-------|--------|
| Q-01 | {{Questão pendente de decisão}} | {{Alto / Médio / Baixo}} | {{Responsável}} | {{AAAA-MM-DD}} | {{Aberta / Resolvida}} |
| Q-02 | {{Questão pendente de decisão}} | {{Alto / Médio / Baixo}} | {{Responsável}} | {{AAAA-MM-DD}} | {{Aberta / Resolvida}} |

---

## 20. Referências

- {{Link para pesquisa de usuário}}
- {{Link para benchmarks / análise competitiva}}
- {{Link para documentação técnica relacionada}}
- {{Link para ADRs relevantes}}
- {{Link para Figma / protótipos}}
- {{Link para blueprint do sistema (quando gerado)}}

---

## Histórico de Revisões

| Versão | Data | Autor | Mudança |
|--------|------|-------|---------|
| {{v0.1.0}} | {{AAAA-MM-DD}} | {{autor}} | Criação |

---

## Aprovações

| Papel | Responsável | Status | Data |
|-------|-------------|--------|------|
| Produto | {{nome}} | {{Pendente / Aprovado}} | |
| Engenharia | {{nome}} | {{Pendente / Aprovado}} | |
| Design | {{nome}} | {{Pendente / Aprovado}} | |
| Segurança | {{nome}} | {{Pendente / Aprovado}} | |
| Stakeholder | {{nome}} | {{Pendente / Aprovado}} | |
