# Mapeamento de Erros — Backend → UX Frontend

> Conecta codigos de erro do backend com acoes de UX no frontend. Este documento garante que cada erro tem uma resposta visual consistente.

---

## Mapa de Erros

> Para CADA codigo de erro do backend, documente a resposta no frontend.

| Codigo Backend | Status HTTP | Mensagem para Usuario | Acao UI | Componente | Retentavel |
| --- | --- | --- | --- | --- | --- |
| {{VALIDATION_ERROR}} | {{400}} | {{Exibir erros por campo}} | {{Highlight campos invalidos, scroll para primeiro erro}} | {{Form + FieldError}} | {{Sim (usuario corrige)}} |
| {{INVALID_CREDENTIALS}} | {{401}} | {{"Email ou senha incorretos"}} | {{Shake no form, limpar campo de senha}} | {{LoginForm}} | {{Sim (usuario tenta de novo)}} |
| {{TOKEN_EXPIRED}} | {{401}} | {{Silencioso → tentar refresh}} | {{Se refresh falha: modal "Sessao expirada" → redirect login}} | {{AuthProvider}} | {{Auto (refresh token)}} |
| {{INVALID_TOKEN}} | {{401}} | {{"Sessao invalida"}} | {{Limpar tokens, redirect login}} | {{AuthProvider}} | {{Nao}} |
| {{INSUFFICIENT_PERMISSIONS}} | {{403}} | {{"Voce nao tem permissao"}} | {{Toast erro + manter na pagina}} | {{Toast}} | {{Nao}} |
| {{RESOURCE_OWNERSHIP}} | {{403}} | {{"Recurso nao encontrado"}} | {{Redirect para lista (nao revelar existencia)}} | {{Router}} | {{Nao}} |
| {{NOT_FOUND}} | {{404}} | {{"Pagina nao encontrada"}} | {{Tela 404 com link para home}} | {{NotFoundPage}} | {{Nao}} |
| {{DUPLICATE_RESOURCE}} | {{409}} | {{"Ja existe um registro com estes dados"}} | {{Highlight campo duplicado, sugerir acao}} | {{Form + FieldError}} | {{Sim (usuario altera)}} |
| {{INVALID_STATE_TRANSITION}} | {{422}} | {{"Acao nao permitida neste momento"}} | {{Toast aviso + desabilitar botao}} | {{Toast + ActionButton}} | {{Nao}} |
| {{RATE_LIMIT_EXCEEDED}} | {{429}} | {{"Muitas tentativas. Aguarde X segundos"}} | {{Desabilitar form + countdown}} | {{RateLimitBanner}} | {{Sim (apos cooldown)}} |
| {{EXTERNAL_SERVICE_ERROR}} | {{502}} | {{"Servico temporariamente indisponivel"}} | {{Toast + botao retry}} | {{Toast + RetryButton}} | {{Sim (retry)}} |
| {{INTERNAL_ERROR}} | {{500}} | {{"Algo deu errado. Tente novamente"}} | {{Toast erro + log para observabilidade}} | {{Toast + ErrorBoundary}} | {{Sim (retry)}} |

<!-- APPEND:erros -->

---

## Padroes de UI por Tipo de Erro

> Como cada categoria de erro e apresentada visualmente.

| Categoria | Componente | Estilo | Duracao | Acao Secundaria |
| --- | --- | --- | --- | --- |
| {{Validacao (400)}} | {{Inline em cada campo}} | {{Borda vermelha + texto abaixo}} | {{Permanente ate corrigir}} | {{—}} |
| {{Auth (401)}} | {{Modal ou redirect}} | {{Overlay + CTA para login}} | {{Ate usuario agir}} | {{Salvar URL atual para redirect apos login}} |
| {{Permissao (403)}} | {{Toast}} | {{Vermelho, icone cadeado}} | {{5s auto-dismiss}} | {{—}} |
| {{Nao encontrado (404)}} | {{Pagina inteira}} | {{Ilustracao + CTA home}} | {{Permanente}} | {{Link para busca}} |
| {{Conflito (409)}} | {{Inline no campo + toast}} | {{Amarelo warning}} | {{Permanente}} | {{Sugerir acao (ex: "fazer login")}} |
| {{Negocio (422)}} | {{Toast}} | {{Amarelo warning}} | {{5s}} | {{Explicar por que a acao nao e possivel}} |
| {{Rate limit (429)}} | {{Banner topo}} | {{Amarelo + countdown}} | {{Ate reset}} | {{Desabilitar interacoes}} |
| {{Servidor (500/502)}} | {{Toast + retry}} | {{Vermelho + botao}} | {{10s ou ate retry}} | {{Log request ID para suporte}} |

---

## Fallback Global (ErrorBoundary)

> Se um erro nao mapeado ocorrer:

```
1. Capturar via ErrorBoundary (React) ou onErrorCaptured (Vue)
2. Logar erro com requestId, stack, context no servico de observabilidade
3. Exibir tela generica: "Algo deu errado. [Tentar novamente] [Voltar ao inicio]"
4. Se o erro persistir apos retry: "Entre em contato com suporte. Ref: {{requestId}}"
```

> Referenciado por:
> - `docs/backend/09-errors.md` (catalogo de erros)
> - `docs/frontend/11-security.md` (protecao contra vazamento de info)
> - `docs/frontend/12-observability.md` (error tracking)
