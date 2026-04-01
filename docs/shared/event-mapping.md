# Mapeamento de Eventos — Backend → Frontend

> Conecta eventos de dominio do backend com acoes no frontend. Este documento e a fonte unica para entender como mudancas no servidor impactam o estado do cliente.

---

## Mapa de Eventos

> Para CADA evento do backend, documente como o frontend reage.

| Evento Backend | Origem (Service) | Canal | Acao Frontend | Store/State Impactado | UI Update |
| --- | --- | --- | --- | --- | --- |
| {{UserCreated}} | {{UserService}} | {{REST response / WebSocket}} | {{Redirect para dashboard}} | {{authStore}} | {{Toast "Conta criada"}} |
| {{OrderPaid}} | {{PaymentService}} | {{WebSocket / Polling}} | {{Atualizar status do pedido}} | {{orderStore}} | {{Badge "Pago" + confetti}} |
| {{OrderShipped}} | {{OrderService}} | {{Push notification}} | {{Notificar usuario}} | {{notificationStore}} | {{Toast + push}} |
| {{TokenExpired}} | {{AuthMiddleware}} | {{401 response}} | {{Tentar refresh, se falhar → login}} | {{authStore}} | {{Modal "Sessao expirada"}} |

<!-- APPEND:eventos -->

---

## Canais de Comunicacao

> Como o frontend recebe eventos do backend?

| Canal | Tecnologia | Quando Usar | Latencia |
| --- | --- | --- | --- |
| {{REST Response}} | {{HTTP}} | {{Resposta imediata a acao do usuario}} | {{< 200ms}} |
| {{WebSocket}} | {{Socket.io / WS}} | {{Atualizacoes em tempo real (chat, status)}} | {{< 100ms}} |
| {{Polling}} | {{HTTP interval}} | {{Fallback quando WS nao disponivel}} | {{Intervalo configurado}} |
| {{Push Notification}} | {{FCM / APNs}} | {{Usuario nao esta na app}} | {{Segundos}} |
| {{Server-Sent Events}} | {{SSE}} | {{Stream unidirecional (feeds, logs)}} | {{< 100ms}} |

---

## Impacto de Mudanca de Payload

> Se o payload de um evento mudar no backend, quais frontends quebram?

| Evento | Campo | Frontend que Consome | Impacto se Removido |
| --- | --- | --- | --- |
| {{UserCreated}} | {{email}} | {{authStore, ProfilePage}} | {{Tela de perfil fica vazia}} |
| {{OrderPaid}} | {{orderId}} | {{orderStore, OrderDetail}} | {{Nao consegue atualizar status}} |

<!-- APPEND:impacto -->

> Referenciado por:
> - `docs/backend/12-events.md` (produtor)
> - `docs/frontend/05-state.md` (consumidor — stores)
> - `docs/frontend/06-data-layer.md` (API client)
> - `docs/frontend/08-flows.md` (consumidor — fluxos de UI dirigidos por eventos)
