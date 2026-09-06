# 05 — API

## 5.1 REST, non GraphQL

I consumatori dell'API sono: il gestionale web, l'app staff, la pagina di prenotazione pubblica, BetterCallQ, i webhook di GHL. Di questi, **i due più importanti sono macchine** (BetterCallQ e le integrazioni), e per una macchina un contratto REST con OpenAPI è più semplice da consumare, più facile da cachare e molto più facile da limitare in rate.

GraphQL risolverebbe l'over-fetching sull'agenda, dove servono appuntamenti + staff + servizi + clienti in una sola vista. Il problema è reale ma si risolve con **endpoint compositi** (`GET /v1/agenda/day` restituisce tutto il necessario per una giornata in una risposta) senza pagare il costo di un layer GraphQL: query di profondità arbitraria da limitare, caching HTTP perso, rate limiting per costo invece che per richiesta, e un secondo modello di autorizzazione da mantenere in parallelo alla RLS.

**Decisione: REST + OpenAPI 3.1 generato dagli schemi Zod di `packages/contracts`.** Il documento OpenAPI non è scritto a mano: è un artefatto della build, quindi non può divergere dall'implementazione.

## 5.2 Convenzioni trasversali

- Base URL versionata: `/v1`. La versione cambia solo per breaking change; le aggiunte sono retrocompatibili per contratto.
- `Authorization: Bearer <jwt>`.
- `Idempotency-Key: <uuid>` — **obbligatorio** su tutte le POST che creano risorse di dominio (prenotazioni, ricevute, movimenti).
- Paginazione **a cursore** (`?cursor=&limit=`), mai offset: le liste (rubrica, ricevute) crescono e vengono scritte mentre si paginano.
- Timestamp sempre ISO 8601 con offset; il client non deve mai inferire il fuso.
- Errori in formato **RFC 9457 (Problem Details)**:

```json
{
  "type": "https://api.turbobooking.it/errors/slot-unavailable",
  "title": "Lo slot non è più disponibile",
  "status": 409,
  "detail": "L'operatore risulta occupato dalle 15:00 alle 16:15",
  "instance": "/v1/bookings/holds",
  "conflicting_segment_id": "…",
  "suggested_alternatives": [ { "starts_at": "…", "staff_id": "…" } ]
}
```

L'estensione `suggested_alternatives` sul 409 non è un dettaglio: è ciò che permette a BetterCallQ e al booking conversazionale di recuperare la conversazione invece di interromperla.

### Token

```json
{
  "sub": "<user_id>",
  "org": "<organization_id>",
  "role": "receptionist",
  "venues": ["<venue_id>", "…"],
  "scopes": ["booking:write", "pos:write"],
  "exp": 1730000000
}
```

`org` alimenta `SET LOCAL app.current_org` a ogni transazione (§01). `venues` filtra a livello applicativo. `role` guida sia i permessi sia il **mascheramento dei campi in risposta**.

### Rate limiting

Per client, con `Retry-After` e header `RateLimit-*`:

| Fascia | Chi | Limite |
|---|---|---|
| `session` | Utenti autenticati (web/app) | 600 req/min |
| `integration` | BetterCallQ, client M2M | 300 req/min, **burst 50/s** su `/availability` |
| `public` | Pagina prenotazione, non autenticata | 60 req/min per IP + captcha su `/holds` |
| `webhook` | Provider in ingresso | 1000 req/min, firma obbligatoria |

`/availability` ha un limite più generoso ma è **cachabile**: `Cache-Control: private, max-age=30` sul risultato pubblico, invalidato dagli eventi. Un abuso su questo endpoint è il vettore di DoS più probabile del sistema, perché è l'unico costoso e non autenticato.

## 5.3 Endpoint per modulo

### Booking e Agenda

```
GET    /v1/availability                       slot disponibili
       ?venue_id&service_ids[]&staff_id?&resource_id?&from&to&granularity?
GET    /v1/availability/next                  primo slot utile (ottimizzato per il vocale)
POST   /v1/bookings/holds                     crea hold (TTL 7 min)  ⟵ Idempotency-Key
DELETE /v1/bookings/holds/{id}                rilascia
POST   /v1/bookings/{id}/confirm              hold → confirmed
PATCH  /v1/bookings/{id}                      riprogramma / cambia operatore o servizi
POST   /v1/bookings/{id}/cancel               { reason, notify: bool }
POST   /v1/bookings/{id}/no-show
POST   /v1/bookings/{id}/check-in             → in_progress
GET    /v1/bookings/{id}
GET    /v1/agenda/day?venue_id&date&staff_ids[]     vista completa giornata
GET    /v1/agenda/week?venue_id&week_start
GET    /v1/agenda/stream                      SSE: push delle modifiche
GET    /v1/agenda/conflicts                   conflitti aperti da risolvere
POST   /v1/agenda/blocks                      blocco manuale di agenda
```

`GET /v1/agenda/day` è l'endpoint composito che sostituisce GraphQL: restituisce appuntamenti con segmenti, staff con turni, assenze, chiusure, occupazioni esterne e conflitti in una sola risposta. È il singolo endpoint più chiamato del sistema e va progettato per una risposta sotto i 150 ms.

### Clienti (Rubrica) e CRM

```
GET    /v1/customers?q=&segment=&last_visit_before=&cursor=
GET    /v1/customers/lookup?phone=              ⟵ BetterCallQ, indicizzato
POST   /v1/customers
GET    /v1/customers/{id}
PATCH  /v1/customers/{id}
DELETE /v1/customers/{id}                       anonimizzazione, non delete fisico
GET    /v1/customers/{id}/history               appuntamenti + ricevute
GET    /v1/customers/{id}/notes                 ⚠ art.9 — audit su ogni lettura
POST   /v1/customers/{id}/notes
GET    /v1/customers/{id}/media                 ⚠ art.9 — URL firmati 5 min
POST   /v1/customers/{id}/media                 upload diretto S3 pre-firmato
GET    /v1/customers/{id}/consents
PUT    /v1/customers/{id}/consents/{purpose}
POST   /v1/customers/export                     job asincrono → CSV firmato
GET    /v1/segments                             definizioni + conteggi
```

Gli endpoint `notes` e `media` sono gli unici che scrivono in `audit_log` a ogni **lettura**, non solo a ogni scrittura. È un requisito di accountability GDPR, non una scelta di prodotto.

### Cassa e POS

```
POST   /v1/cash-sessions/open                 { register_id, opening_float }
POST   /v1/cash-sessions/{id}/close           { counted_cash } → Z-report
GET    /v1/cash-sessions/current?venue_id
POST   /v1/cash-sessions/{id}/movements       entrata/uscita contanti
POST   /v1/checkout                           ⟵ Idempotency-Key
       { appointment_id?, lines[], payments[], customer_id?, promo_code? }
GET    /v1/receipts?venue_id&from&to&cursor
GET    /v1/receipts/{id}
POST   /v1/receipts/{id}/void                 annullo con documento di storno
POST   /v1/receipts/{id}/reprint-fiscal       riemissione dopo errore stampante
POST   /v1/receipts/{id}/einvoice             genera XML SDI e accoda
GET    /v1/reports/daily-summary?venue_id&date       Corrispettivi
```

`POST /v1/checkout` è transazionale: crea la ricevuta, le righe, i pagamenti, scarica il magazzino, consuma token di abbonamento, accredita punti loyalty, chiude l'appuntamento e scrive gli eventi in outbox — **in una sola transazione**. La stampa fiscale avviene dopo il commit ed è ritentabile: separare il commit dalla stampa è ciò che rende possibile la modalità degradata di §04.6.

### Trattamenti, Staff, Postazioni, Orari

```
GET|POST     /v1/services            PATCH|DELETE /v1/services/{id}
GET|PUT      /v1/services/{id}/segments          definizione delle fasi
GET|POST     /v1/service-categories
GET|POST     /v1/packages
GET|POST     /v1/staff               PATCH /v1/staff/{id}
GET|PUT      /v1/staff/{id}/services             abilitazioni + prezzi custom
GET|PUT      /v1/staff/{id}/schedule             turni settimanali
GET|POST     /v1/staff/{id}/absences             ferie e permessi
GET|POST     /v1/resources
GET|PUT      /v1/venues/{id}/hours               orari standard
GET|POST     /v1/venues/{id}/hour-exceptions     aperture e chiusure straordinarie
GET|PUT      /v1/venues/{id}/booking-rules
```

Modificare i segmenti di un servizio o i turni di un operatore **invalida le maschere in Redis** e può generare conflitti su appuntamenti futuri: questi endpoint restituiscono sempre l'elenco degli appuntamenti impattati, e richiedono `?confirm=true` se non è vuoto. Cambiare un orario senza sapere chi si sta spostando è il modo più rapido di perdere la fiducia dell'utente.

### Magazzino

```
GET|POST /v1/products                PATCH /v1/products/{id}
GET      /v1/products/{id}/stock                giacenza per sede
POST     /v1/stock/movements                    carico/scarico/rettifica manuale
GET      /v1/stock/movements?product_id&from&to
POST     /v1/stock/inventory-count              inventario fisico → rettifiche
GET      /v1/stock/alerts                       sotto scorta, in scadenza, morti
GET|POST /v1/suppliers      GET|POST /v1/manufacturers
GET|POST /v1/purchase-orders
POST     /v1/purchase-orders/{id}/send          PDF/CSV al fornitore
POST     /v1/purchase-orders/{id}/receive       carico (parziale o totale)
GET      /v1/purchase-orders/due                Scadenzario
GET|POST /v1/expenses
```

### Marketing, Loyalty, Recensioni

```
GET      /v1/notifications?appointment_id&customer_id     log invii
POST     /v1/notifications/test                           invio di prova
GET|POST /v1/promotions
POST     /v1/promotions/{code}/validate                   ⟵ chiamato dal checkout
GET|POST /v1/gift-cards      POST /v1/gift-cards/{code}/redeem
GET      /v1/loyalty/wallets/{customer_id}
POST     /v1/loyalty/adjust                               accredito/storno manuale
GET      /v1/reviews?venue_id&staff_id&rating&source
POST     /v1/reviews/{id}/reply
POST     /v1/reviews/request                              → workflow GHL
```

Le **campagne non hanno endpoint**: vivono in GHL. TurboBooking espone i segmenti e riceve gli esiti.

### Statistiche

```
GET /v1/analytics/overview?venue_id&from&to      Analisi Andamento
GET /v1/analytics/company                         Report Azienda
GET /v1/analytics/fiscal                          Corrispettivi
GET /v1/analytics/staff                           Report Collaboratori
GET /v1/analytics/customers                       Report Clienti
GET /v1/analytics/inventory                       Report Magazzino
GET /v1/analytics/inventory/snapshot?at=          Report Inventario a una data
GET /v1/analytics/profitability                   margine per servizio/categoria
```

Tutti accettano `?compare_to=previous_period|previous_year` (i confronti sono la parte utile) ed esportano in CSV con `Accept: text/csv`. Accessibili solo a `owner` e `manager`.

### Integrazioni e amministrazione

```
GET    /v1/integrations                        stato di ogni connessione
POST   /v1/integrations/google/connect         avvia OAuth per operatore
DELETE /v1/integrations/google/{staff_id}
POST   /v1/integrations/ghl/install            callback OAuth Location
POST   /v1/integrations/ghl/resync
GET|POST /v1/users        PATCH /v1/users/{id}
GET|POST /v1/api-clients                       credenziali M2M (solo owner)
GET    /v1/audit-log?entity_type&entity_id&from&to
```

### Webhook in ingresso

```
POST /webhooks/ghl        firma HMAC obbligatoria
POST /webhooks/google     canale watch + syncToken
POST /webhooks/stripe     firma Stripe
POST /webhooks/sdi        esiti dall'intermediario
```

Tutti rispondono **`202 Accepted` immediatamente** dopo aver persistito il payload in `inbound_webhooks`. L'elaborazione è asincrona. Un webhook che risponde lentamente viene ritentato dal provider e produce duplicati: la deduplica sull'id evento è obbligatoria, non facoltativa.

### Booking pubblico (non autenticato)

```
GET  /public/v1/venues/{slug}
GET  /public/v1/venues/{slug}/services
GET  /public/v1/venues/{slug}/availability
POST /public/v1/venues/{slug}/holds          + captcha
POST /public/v1/venues/{slug}/bookings       conferma (+ deposito se richiesto)
GET  /public/v1/bookings/{token}             gestione self-service con token opaco
POST /public/v1/bookings/{token}/cancel
```

Namespace separato perché ha regole diverse: nessun JWT, rate limit per IP, **applicazione delle `booking_rules`** (preavviso minimo, orizzonte massimo) che l'agenda interna può invece scavalcare, e superficie dati ridotta al minimo. Tenerlo sotto `/v1` con un flag "sono pubblico" porta prima o poi a esporre un campo di troppo.

## 5.4 Realtime

`GET /v1/agenda/stream?venue_id=` — Server-Sent Events, autenticato con token in query (l'API SSE del browser non permette header custom) a vita breve, ottenuto da `POST /v1/agenda/stream-token`.

Eventi: `appointment.created|updated|cancelled`, `agenda.conflict`, `slot.held` (per l'indicatore "un collega sta prenotando"), `cash.session_closed`.

Il client TanStack Query aggiorna la cache locale, senza refetch. La riconnessione è nativa in SSE; ogni evento porta un `Last-Event-ID` per recuperare il gap dopo una disconnessione.
