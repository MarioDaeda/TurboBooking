# 01 — Architettura e stack tecnologico

## 1.1 Vincoli che guidano le scelte

Le scelte sotto non sono "best practice generiche": derivano da quattro vincoli specifici di TurboBooking.

| # | Vincolo | Conseguenza architetturale |
|---|---------|----------------------------|
| V1 | **Concorrenza su risorsa scarsa.** Lo stesso slot può essere richiesto simultaneamente da: agenda desktop, booking pubblico, WhatsApp, Instagram, BetterCallQ (telefono). Cinque scritture concorrenti sullo stesso "inventario". | La garanzia di non-overbooking deve stare **nel database**, non nel codice applicativo. Nessun canale può bypassarla. |
| V2 | **Servizio multi-fase con risorse eterogenee.** Un colore occupa l'operatore 20', poi lo libera per 30' di posa (durante cui la poltrona resta occupata), poi lo rioccupa 25'. L'operatore *deve* poter servire un altro cliente durante la posa. | L'unità prenotabile non è l'appuntamento ma il **segmento**. La disponibilità non è un intervallo ma una maschera bit. |
| V3 | **Latenza sub-secondo per BetterCallQ.** Un receptionist AI al telefono non può far aspettare 3 secondi per "sabato alle 15 ho posto?". | Ricerca disponibilità servita da **struttura precalcolata in Redis**, non da query SQL ad-hoc su `appointments`. Budget: p95 < 250 ms. |
| V4 | **Isolamento multi-tenant con dati art. 9 GDPR** (allergie, patologie cutanee nelle note tecniche). | **Row-Level Security a livello DBMS**, non solo `WHERE tenant_id = ?`. Un bug applicativo non deve poter causare data leak fra saloni. |
| V5 | **GoHighLevel come piattaforma di engagement.** Messaggistica multicanale, workflow marketing, funnel/sito e reputation sono delegati a GHL invece di essere costruiti. | TurboBooking è il **system of record**; GHL è il **system of engagement**. Serve una matrice di proprietà del dato esplicita e un anti-corruption layer (§1.7, §04). |

## 1.2 Stack proposto

### Backend — NestJS 11 (TypeScript) su Fastify

**Perché NestJS e non FastAPI/Python:**

- **Tipi condivisi end-to-end.** Il contratto del booking engine (segmenti, maschere, stati) è la parte più delicata del sistema e viene consumato da 4 client diversi (web, app staff, BetterCallQ, integrazioni). Un monorepo TS con un pacchetto `@turbobooking/contracts` generato da Zod dà validazione runtime + tipi compile-time su tutti i client con una sola fonte di verità. In un mondo Python/TS questo contratto va mantenuto due volte.
- **Il modulo NestJS mappa 1:1 sul modulo funzionale.** `BookingModule`, `PosModule`, `InventoryModule`… con dependency injection e `Guard` per RBAC/tenant scoping applicati in modo dichiarativo e non ripetuto per endpoint.
- **Fastify adapter** (non Express): ~2x throughput, JSON schema serialization nativa. Rilevante per V3.
- Python resterebbe preferibile solo se il cuore fosse ML/data science. Qui il cuore è **logica temporale e transazionale**, dove il vantaggio Python non si applica.

**Rinuncia accettata:** ecosistema data/analytics più povero. Mitigato tenendo la parte BI su SQL + eventuale worker Python separato in Fase 4.

### Database — PostgreSQL 16

Non negoziabile per questo progetto, per tre funzionalità specifiche:

1. **`EXCLUDE USING gist` + `btree_gist`** → vincolo di non-sovrapposizione dichiarativo a livello di tabella. Risolve V1 in modo definitivo (vedi §02).
2. **Row-Level Security** → risolve V4.
3. **`tstzrange`** → aritmetica di intervalli temporali nativa, con indici GiST.

Estensioni richieste: `btree_gist`, `pgcrypto`, `pg_trgm` (ricerca fuzzy in Rubrica), `citext` (email).

### Redis 7 — tre ruoli distinti, da non confondere

| Ruolo | Uso | Criticità se cade |
|-------|-----|-------------------|
| **Cache maschere disponibilità** | Bitmap giornaliere per staff/risorsa (V3) | Degrado prestazionale: fallback su ricalcolo SQL. Nessuna perdita di correttezza. |
| **Broker BullMQ** | Code notifiche, sync calendario, ETL | Ritardo nelle notifiche, recuperato al riavvio (job persistiti) |
| **Lock advisory di checkout** | UX: "slot in fase di conferma da un altro operatore" | Nessuna: la correttezza è garantita da Postgres, non dal lock |

> **Decisione chiave.** Il distributed lock Redis descritto nella specifica iniziale viene **declassato da meccanismo di correttezza a meccanismo di UX**. Motivo: un lock Redis è soggetto a clock drift, partizioni di rete e fallimenti del rilascio; affidarci ad esso per l'integrità dell'agenda significherebbe accettare overbooking rari ma reali. Il vincolo `EXCLUDE` di Postgres è invece atomico e transazionale per costruzione. Il lock resta utile solo per evitare che due receptionist lavorino sullo stesso slot e uno scopra il conflitto solo al submit.

### Message broker — BullMQ (su Redis) in Fase 1-2, RabbitMQ da Fase 3

Partire con RabbitMQ/SQS significa gestire infrastruttura aggiuntiva prima di averne il bisogno. BullMQ copre: retry con backoff esponenziale, job ritardati (il promemoria T-24h è letteralmente un `delay`), rate limiting per coda (essenziale per le quota WhatsApp/Google), dead letter queue.

Con GoHighLevel nello stack il fan-out verso i canali si riduce drasticamente: la coda `notifications` ha **un solo consumer** (l'adapter GHL) invece di uno per canale. Questo sposta il trigger di migrazione a RabbitMQ molto più avanti nel tempo.

**Trigger di migrazione a RabbitMQ:** quando servono routing topic-based fra più consumer indipendenti (Fase 3, con fan-out di `appointment.confirmed` verso 5+ sottoscrittori) o quando la coda supera ~10k job/minuto sostenuti.

**Pattern obbligatorio da subito: transactional outbox.** Gli eventi non vengono pubblicati dal codice applicativo dopo il commit (finestra in cui un crash perde l'evento), ma scritti in tabella `outbox_events` **nella stessa transazione** della modifica di dominio; un relay li pubblica. Senza questo, un appuntamento può risultare confermato in TurboBooking ma mai sincronizzato su Google Calendar e mai notificato al cliente — il tipo di bug che distrugge la fiducia del salone nel sistema.

### Frontend — Next.js 15 (App Router) + React 19

- **TanStack Query** per il server state, con `optimistic update` sull'agenda (il drag&drop di un appuntamento deve essere istantaneo, con rollback in caso di 409).
- **La griglia agenda è un componente custom, non una libreria.** FullCalendar e simili non modellano segmenti multi-risorsa con buchi (posa) né la colonna-per-operatore con risorsa secondaria. Serve un layout virtualizzato proprietario su canvas/CSS grid. È il componente frontend più costoso del progetto: stimare 3-4 settimane a sé.
- **Realtime**: SSE (`/v1/agenda/stream`) e non WebSocket. L'agenda ha bisogno di push server→client unidirezionale; SSE attraversa i proxy senza configurazione, si riconnette da solo e costa molto meno in complessità. Le scritture passano da normali POST.
- **Tailwind + shadcn/ui**, con design token calibrati per replicare l'estetica Treatwell (la specifica richiede attrito minimo nel passaggio). La UI kit va costruita a partire dagli screenshot in `foto-treatwellpro/` **prima** di scrivere le schermate.

### App staff — Expo / React Native

Riusa `@turbobooking/contracts`. Requisito funzionale specifico: **mascheramento dei dati sensibili lato server**, non lato client (vedi §1.4).

### Storage file — S3-compatibile (Cloudflare R2 o MinIO self-hosted in UE)

Foto prima/dopo dei clienti = dato personale, potenzialmente art. 9. Bucket privato, accesso solo via **URL firmati a scadenza breve (5 min)**, mai URL pubblici. Cifratura server-side + chiave per tenant.

### OLAP / BI — approccio a tre stadi

Non introdurre ClickHouse in Fase 1 è una scelta deliberata: il volume di un singolo salone (≈50-200 appuntamenti/giorno) non giustifica un data warehouse.

1. **Fase 1-2**: query dirette con indici mirati + **vista materializzata** rinfrescata di notte per i report pesanti.
2. **Fase 3**: **read replica** dedicata; tutti i report ci puntano. Zero impatto sull'OLTP.
3. **Fase 4**: ETL notturno verso ClickHouse *solo se* i report multi-sede su 3+ anni superano i 2s.

### Autenticazione

- **Access token JWT 15 min** + **refresh token opaco rotante** (famiglia con revoca a cascata su riuso: rileva furto di token).
- Hash password **Argon2id**.
- MFA TOTP obbligatoria per ruolo `owner` (accede a dati fiscali e finanziari).
- Le integrazioni server-to-server (BetterCallQ) usano **OAuth2 client_credentials** con scope granulari, **non** un JWT utente.

### Infrastruttura

Docker + deploy su **regione UE** (obbligatorio: dati art. 9 GDPR). Opzione consigliata per il volume iniziale: Hetzner + Coolify o Fly.io (Francoforte/Amsterdam); AWS ECS/Fargate quando il numero di saloni giustifica il costo.

Osservabilità da subito: OpenTelemetry (trace distribuiti — indispensabile per debuggare un flusso WhatsApp → booking → Google Calendar), Sentry, log strutturati JSON con `organization_id` e `request_id` in ogni riga.

## 1.3 Multi-tenancy: modello a tre livelli

```
organization  (l'azienda cliente — es. "Gianluca Tadonio Hair & Beauty")
   └── venue  (la sede fisica — es. "Attrazione Solare, via X")
         └── staff / resources / appointments / cash_registers
```

**`organization_id` è il tenant.** Le decisioni derivate:

- Ogni tabella di dominio porta `organization_id` **non nullable**, come **prima colonna di ogni indice composito**.
- **RLS attiva su tutte le tabelle**, con policy `USING (organization_id = current_setting('app.current_org')::uuid)`.
- L'applicazione si connette con un ruolo **`NOBYPASSRLS`**. Il ruolo di migrazione è separato e non è usato dal runtime.
- Un interceptor NestJS esegue `SET LOCAL app.current_org = $1` **all'apertura di ogni transazione**. `SET LOCAL` (non `SET`) è obbligatorio: con un connection pool, un `SET` normale sopravvive alla restituzione della connessione al pool e contaminerebbe la richiesta successiva — con conseguente accesso cross-tenant. Questo è il singolo punto in cui un errore causa il danno peggiore del sistema; va coperto da test di integrazione dedicati.
- `venue_id` **non** è un livello di isolamento ma di **autorizzazione**: un utente ha una lista di `venue_ids` accessibili nel token, filtrata a livello applicativo.

Database singolo condiviso. Lo sharding per tenant si valuta oltre i ~500 saloni; prima è complessità non ripagata.

## 1.4 RBAC e mascheramento

Quattro ruoli base, estendibili con permessi granulari:

| Ruolo | Ambito |
|-------|--------|
| `owner` / Titolare | Tutto: configurazione, report finanziari, fatturazione SaaS, gestione utenti |
| `manager` | Come owner, escluse fatturazione SaaS e gestione utenti |
| `receptionist` | Agenda, cassa, rubrica, comunicazioni. **No** report di redditività, **no** costi/commissioni staff |
| `staff` | Solo la propria agenda, sola lettura, dati cliente mascherati |

**Il mascheramento avviene nel serializer lato server**, mai nel client. Un'app mobile che riceve il telefono del cliente e lo nasconde in UI è una violazione GDPR mascherata da feature: il dato è comunque sul dispositivo e ispezionabile. La regola: se il ruolo non può vedere il campo, il campo **non esce dall'API**.

Implementazione: decorator `@Sensitive('customer.phone', ['owner','manager','receptionist'])` sui DTO di risposta + interceptor che applica il filtro in base ai claim del token.

## 1.5 Struttura del monorepo

```
turbobooking/
├── apps/
│   ├── api/              # NestJS — REST + webhook + SSE
│   ├── worker/           # BullMQ consumers (notifiche, sync, ETL)
│   ├── web/              # Next.js — gestionale
│   ├── booking/          # Next.js — pagina prenotazione pubblica (white-label)
│   └── mobile/           # Expo — app staff
├── packages/
│   ├── contracts/        # Schemi Zod + tipi + client OpenAPI generato
│   ├── booking-core/     # ⭐ motore slot: puro, senza I/O, 100% testabile
│   ├── db/               # migrazioni + query builder (Kysely)
│   └── ui/               # design system "Treatwell-like"
├── db/schema.sql
└── docs/
```

**`packages/booking-core` è il cuore e va scritto per primo, in isolamento.** Funzioni pure: date/maschere in ingresso, slot in uscita. Nessuna dipendenza da DB, HTTP o Redis. È l'unico modo per testarne le centinaia di casi limite (DST, posa che scavalca la pausa pranzo, servizio che richiede due operatori, chiusura straordinaria a metà di un servizio) senza fixture di database.

## 1.6 ORM: Kysely, non Prisma/TypeORM

Il motore di disponibilità genera query con `tstzrange`, operatori GiST, CTE ricorsive e `EXCLUDE`. Prisma non le esprime e costringerebbe a `$queryRaw` proprio nella parte più critica — perdendo i tipi esattamente dove servono di più. **Kysely** dà SQL tipizzato senza astrazioni che nascondono il piano di esecuzione. Migrazioni gestite con `node-pg-migrate` in SQL puro e versionate: lo schema è un asset di progetto, non un artefatto generato.

## 1.7 Il ruolo di GoHighLevel: system of record vs system of engagement

GoHighLevel copre nativamente una parte consistente di ciò che la specifica iniziale prevedeva di costruire: messaggistica SMS/Email/WhatsApp/Instagram/Messenger, workflow di automazione, funnel e siti white-label, richieste di recensione, calendari, pipeline CRM. Costruire quella parte da zero sarebbe lavoro sprecato.

Ma GHL **non può** essere il sistema centrale di TurboBooking, per tre ragioni non aggirabili:

1. **I calendari GHL non modellano il dominio.** Non hanno segmenti, non hanno tempo di posa con liberazione dell'operatore, non hanno risorse fisiche come entità prenotabile, non hanno durate per-operatore. Sono calendari da consulenza, non da salone. Il §02 non è implementabile sopra di essi.
2. **Nessuna copertura fiscale italiana.** Registratore telematico, corrispettivi, fattura elettronica SDI, conservazione sostitutiva: fuori scope per GHL, per sempre.
3. **Magazzino, cassa, commissioni, redditività**: assenti.

### La divisione

```
┌──────────────────────────────────────────────────────────────┐
│  TURBOBOOKING  —  system of record                           │
│  Booking engine · Agenda · Anagrafica (master) · Cassa e      │
│  fiscalità · Magazzino · Staff e commissioni · BI            │
└───────────────┬──────────────────────────────────────────────┘
                │  anti-corruption layer (packages/integrations/ghl)
                │  ◄── contatti, eventi, tag/segmenti calcolati ──►
                │  ◄── messaggi in uscita / in ingresso ──────────►
┌───────────────┴──────────────────────────────────────────────┐
│  GOHIGHLEVEL  —  system of engagement                        │
│  Conversations (SMS · WhatsApp · Email · IG · Messenger)      │
│  Workflow marketing · Funnel e sito white-label               │
│  Reputation / richiesta recensioni Google · Missed-call       │
└──────────────────────────────────────────────────────────────┘
```

**Il principio che risolve ogni dubbio di attribuzione:** TurboBooking possiede tutto ciò che ha conseguenze **operative o fiscali**; GHL possiede tutto ciò che ha conseguenze **comunicative o commerciali**. Un appuntamento ha conseguenze operative → è nostro. Una sequenza di 5 email di riattivazione ha conseguenze commerciali → è di GHL.

### Cosa cambia nello stack rispetto a §1.2

| Componente previsto | Con GHL |
|---|---|
| WhatsApp Business Cloud API (integrazione diretta) | **Sostituito** dall'adapter GHL Conversations. Nessuna gestione diretta di template HSM, finestra 24h, numero WABA. |
| Meta Graph API per IG/Messenger | **Sostituito**: i canali sono già collegati nella location GHL. |
| Provider SMS (Twilio) + provider email (SES/Postmark) | **Sostituiti** da LC Phone/LC Email di GHL. |
| Motore campagne e segmentazione — esecuzione | **Sostituito** dai Workflow GHL. |
| Motore campagne e segmentazione — **calcolo** | **Resta nostro.** RFM, clienti persi, fedeltà all'operatore si calcolano solo dove ci sono i dati transazionali: da noi. Escono verso GHL come tag e custom field. |
| Pagina prenotazione pubblica | **Resta nostra** (§04). Il funnel GHL può ospitarla via embed, ma la disponibilità la calcola il nostro motore. |
| Sito vetrina white-label | **Delegabile** ai funnel GHL. |
| Recensioni interne (operatore + trattamento) | **Restano nostre**; GHL gestisce la sollecitazione e le recensioni Google pubbliche. |

Restano invariati: Postgres, Redis, il booking engine, il POS/fiscale, il magazzino, la BI.

### L'anti-corruption layer non è opzionale

Costruiamo TurboBooking perché Treatwell è una scatola chiusa. Adottare GHL senza isolamento significherebbe ricreare la stessa dipendenza con un altro fornitore.

Regole vincolanti:

- Nessun `ghlContactId`, nessuna chiamata `services.leadconnectorhq.com`, nessun formato GHL **oltre il confine di `packages/integrations/ghl`**. Il resto del codice conosce solo le interfacce `NotificationChannel`, `ContactSyncTarget`, `MarketingSegmentPublisher`.
- Gli id esterni vivono in una tabella `external_refs` polimorfa (`entity_type`, `entity_id`, `provider`, `external_id`), non come colonne sparse nelle tabelle di dominio. Aggiungere o rimuovere un provider non deve toccare lo schema.
- Ogni funzionalità delegata a GHL deve avere un **percorso di uscita documentato** in §04. Se domani GHL triplica i prezzi, si deve poter sostituire il canale WhatsApp con l'API Cloud diretta implementando una sola classe.

### Vincolo GDPR non negoziabile

GHL è una piattaforma con hosting negli Stati Uniti. Verso GHL possono transitare dati identificativi e di contatto (nome, telefono, email, storico appuntamenti in forma sintetica), **mai** dati riconducibili all'art. 9 GDPR: note tecniche, formule chimiche, allergie, patologie, foto prima/dopo. Il divieto va imposto **nel codice** (allowlist di campi nel mapper, non denylist) e non lasciato alla disciplina di chi scriverà le feature. Dettagli e base giuridica del trasferimento in §07.
