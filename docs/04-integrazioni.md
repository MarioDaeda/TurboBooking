# 04 — Integrazioni esterne

Questo è il capitolo che giustifica l'intero progetto: costruiamo TurboBooking perché Treatwell è chiuso. Il valore sta qui.

> **Nota di validità.** Gli endpoint, gli header di versione e i limiti citati vanno verificati contro la documentazione corrente dei fornitori al momento dell'implementazione: sono API commerciali che cambiano. Ciò che non cambia è il **modello di integrazione** descritto in ogni sezione, che è la parte da decidere adesso.

## 4.1 Matrice di proprietà del dato

La prima cosa da fissare, prima di scrivere una riga di codice di integrazione. Ogni conflitto futuro ("chi vince se cambiano entrambi?") si risolve leggendo questa tabella.

| Dominio | Master | Replica | Direzione | Note |
|---|---|---|---|---|
| Disponibilità e slot | **TurboBooking** | — | — | Non replicabile: dipende dai segmenti |
| Appuntamenti | **TurboBooking** | GHL, Google Calendar | TB → esterni | Scrittura di ritorno **disabilitata** |
| Anagrafica cliente (nome, telefono, email) | **TurboBooking** | GHL | bidirezionale, TB prevale | Dedup su `phone_e164` |
| Consensi marketing | **TurboBooking** | GHL | bidirezionale | Un opt-out da qualunque lato è immediatamente vincolante |
| Note tecniche, formule, allergie, foto | **TurboBooking** | — | **mai** | Art. 9 GDPR |
| Storico transazionale, incassi, fiscale | **TurboBooking** | — | — | Non esce |
| Segmenti CRM / RFM | **TurboBooking** (calcolo) | GHL (tag) | TB → GHL | GHL li usa come trigger |
| Conversazioni (SMS/WA/IG/Messenger) | **GHL** | TB (log sintetico) | GHL → TB | `notification_messages` |
| Campagne, workflow, sequenze | **GHL** | — | — | |
| Funnel, landing, sito vetrina | **GHL** | — | — | Con embed della prenotazione TB |
| Recensioni interne (operatore + trattamento) | **TurboBooking** | — | — | |
| Recensioni pubbliche Google | **GHL** | TB (lettura) | GHL → TB | Vista unificata in "Recensioni" |
| Occupazione da calendari personali staff | **Google** | TB | Google → TB | `external_busy_blocks` |

## 4.2 GoHighLevel

### Struttura degli account

```
Agency (la nostra)
 └── Location  ←→  1 venue TurboBooking
      ├── Contacts        ↔ customers
      ├── Conversations   → canale di consegna di tutte le notifiche
      ├── Workflows       → promemoria, riattivazione, richiesta recensione
      ├── Calendars       ✗ NON usati per la disponibilità
      └── Funnels/Sites   → vetrina white-label
```

**Una Location per `venue`, non per `organization`.** Un salone multisede ha numeri di telefono, orari e clientela diversi per sede; unirli in una Location sola rende impossibile la segmentazione geografica e mescola le conversazioni. Il legame è `external_refs (provider='ghl', entity_type='venue', external_id=<locationId>)`.

### Autenticazione

App Marketplace GHL con **OAuth 2.0**, non API key statica. L'app viene installata sulla Agency e ottiene token a livello di Location; il refresh token va persistito cifrato in `integration_connections`. Motivi:

- una API key compromessa espone tutto e non è revocabile granularmente;
- l'installazione per Location è il modello che regge l'onboarding di un nuovo salone senza intervento manuale;
- gli scope limitano il danno: chiediamo `contacts.*`, `conversations/message.*`, `locations/customFields.*`, `locations/tags.*` — **non** scope su pagamenti o calendari.

Il refresh token GHL ruota a ogni uso: va salvato **nella stessa transazione** in cui viene consumato, altrimenti un crash tra la chiamata e il salvataggio scollega la Location e richiede una re-installazione manuale. È l'errore classico su questa integrazione.

### Sincronizzazione contatti

**Chiave di deduplica: numero di telefono in formato E.164.** Non l'email (i clienti di un salone spesso non ne hanno una, o ne condividono una in famiglia), non il nome. `customers.phone_e164` ha già un indice univoco per organizzazione.

Flusso TB → GHL, guidato dall'outbox:

```
customer.created | customer.updated | customer.segment_changed
   → job ghl.sync-contact
      → upsert contatto (nome, telefono, email, tag, custom field)
      → external_refs.synced_at
```

I **custom field** che pubblichiamo su GHL, e solo questi (allowlist esplicita nel mapper):

| Campo GHL | Origine |
|---|---|
| `tb_customer_id` | `customers.id` — chiave di ritorno |
| `tb_last_visit`, `tb_first_visit` | metriche denormalizzate |
| `tb_visits_count`, `tb_avg_ticket`, `tb_lifetime_value` | idem |
| `tb_preferred_staff` | nome operatore preferito |
| `tb_next_appointment` | prossimo appuntamento confermato |
| `tb_segment` | RFM calcolato da noi |
| `tb_venue` | sede di riferimento |

Tag: `tb_segment_champion`, `tb_segment_at_risk`, `tb_segment_lost`, `tb_new_customer`, `tb_no_show_risk`. I workflow GHL si agganciano ai tag, non ai custom field: è il trigger più affidabile della piattaforma.

Flusso GHL → TB (webhook `ContactCreate` / `ContactUpdate` / `ContactDTORefresh`): crea o aggiorna il cliente **solo** su nome, telefono, email e consensi. Se il contatto esiste già in TB, i campi TB prevalgono su quelli GHL, con una sola eccezione: **un opt-out vince sempre**, da qualunque lato arrivi e senza eccezioni.

### Messaggistica: l'adapter `NotificationChannel`

Tutta la messaggistica in uscita passa da una sola interfaccia:

```ts
interface NotificationChannel {
  readonly kind: 'sms' | 'email' | 'whatsapp' | 'instagram' | 'messenger' | 'push';
  send(msg: OutboundMessage): Promise<DeliveryReceipt>;
  supports(customer: Customer): boolean;   // consenso + reachability
}
```

`GoHighLevelChannel` la implementa per SMS, Email, WhatsApp, Instagram e Messenger tramite l'API Conversations, inviando alla Location corretta. Il resto del sistema **non sa che GHL esiste**.

Cosa questo elimina dal nostro perimetro: provisioning del numero WhatsApp Business, sottomissione e approvazione dei template HSM, gestione della finestra di servizio di 24 ore, collegamento delle pagine Instagram/Facebook, gestione dei bounce email e delle liste di soppressione. Sono settimane-uomo e un'area di rischio operativo continuo.

**Il consenso si verifica da noi, prima dell'invio.** Ogni `send()` è preceduto dal controllo su `customer_consents` per la finalità corrispondente; l'esito viene scritto in `notification_messages.consent_checked`. Delegare a GHL la verifica del consenso significherebbe non essere in grado di dimostrare la conformità in caso di reclamo, dato che il titolare del trattamento è il salone e il responsabile siamo noi.

**Promemoria appuntamento: chi lo manda?** Due opzioni, con una raccomandazione netta.

| | Workflow GHL | Job BullMQ nostro |
|---|---|---|
| Configurabilità per il salone | Alta (editor visuale) | Bassa (va sviluppata) |
| Riprogrammazione dell'appuntamento | Va gestita nel workflow | Cancella e ripianifica il job: banale |
| Tracciabilità in TB | Solo via webhook | Nativa |
| Rischio di promemoria su appuntamento cancellato | **Reale** | Nullo |

**Raccomandazione: i messaggi transazionali (conferma, promemoria T-24h, avviso di cancellazione) sono pianificati da noi** e consegnati tramite GHL. Sono legati allo stato di un appuntamento che può cambiare fino all'ultimo minuto, e un promemoria per un appuntamento annullato è il tipo di errore che il cliente finale nota subito. **I messaggi di marketing** (riattivazione, compleanno, campagne, follow-up recensione) sono interamente workflow GHL, innescati dai tag: lì la flessibilità vale più del controllo.

### Booking conversazionale (WhatsApp / Instagram / Messenger)

```
Cliente ──WhatsApp──► GHL Conversations
                          │  webhook InboundMessage
                          ▼
                   TurboBooking  /webhooks/ghl
                          │  1. persiste in inbound_webhooks
                          │  2. risolve il contatto → customers
                          │  3. agente conversazionale (motore BetterCallQ)
                          │  4. GET disponibilità (nostro motore)
                          │  5. POST hold → conferma
                          ▼
                   GHL Conversations ──WhatsApp──► Cliente
```

GHL trasporta, TurboBooking decide. L'agente conversazionale è **lo stesso motore di BetterCallQ**, con un adapter di trasporto diverso: al telefono parla, su WhatsApp scrive. Una sola logica di dominio da mantenere e da migliorare.

Regole non negoziabili per questo flusso:
- **Nessuna conferma senza hold riuscito.** L'agente non dice "ti ho prenotato" prima che il `POST /holds` abbia restituito 201.
- **Escalation a umano** su: cliente irritato, richiesta fuori dominio, terzo tentativo fallito, richiesta di modifica di un appuntamento con caparra. Il passaggio è un tag GHL + notifica in agenda.
- **Il consenso WhatsApp** va raccolto e registrato: un cliente che scrive spontaneamente apre la finestra di servizio, ma non ha per questo dato consenso al marketing.

### Limiti e resilienza

I limiti di rate documentati per l'API v2 (verificare: nell'ordine dei ~100 richieste/10s per Location e ~200k/giorno) sono ampi per un singolo salone ma **si esauriscono durante gli import massivi e le sincronizzazioni iniziali**. Contromisure obbligatorie:

- coda BullMQ dedicata `ghl` con **limiter per Location**, non globale;
- backoff esponenziale con jitter su `429`, e circuit breaker che dopo N fallimenti mette in pausa la coda invece di bruciare quota;
- **la sincronizzazione GHL non è mai nel percorso sincrono di una richiesta utente.** Un appuntamento si conferma in TurboBooking anche se GHL è irraggiungibile; la replica avviene dopo. Il contrario renderebbe la disponibilità del nostro gestionale dipendente da quella di un fornitore terzo.

### Percorso di uscita

Se GHL diventa insostenibile (prezzo, policy, qualità di consegna), la sostituzione richiede:

| Funzione | Sostituto | Sforzo |
|---|---|---|
| SMS | Twilio / Vonage | ~3 giorni (una classe `NotificationChannel`) |
| Email | Postmark / SES | ~3 giorni |
| WhatsApp | Meta Cloud API diretta | ~3 settimane (WABA, template, finestra 24h) |
| Instagram/Messenger | Meta Graph API | ~2 settimane |
| Workflow marketing | Motore proprio o Customer.io | ~6-8 settimane |
| Funnel/sito | Webflow / Next.js | variabile |

Il costo è concentrato sui workflow di marketing, ed è accettabile. **La condizione perché resti tale è che nessun dato di dominio viva solo dentro GHL:** ogni messaggio inviato ha una riga in `notification_messages`, ogni contatto ha il suo master da noi, ogni segmento è ricalcolabile. Se un giorno servisse esportare tutto da GHL, non ci sarebbe nulla di essenziale da esportare — ed è esattamente il contrario della situazione in cui ci troviamo oggi con Treatwell.

## 4.3 Google Calendar

**Decisione: integrazione diretta, non tramite GHL.** La sincronizzazione calendari di GHL è pensata per i suoi calendari, non per una disponibilità a segmenti; ci serve il controllo su `extendedProperties`, sui `syncToken` incrementali e sulla semantica free/busy. Passare per GHL aggiungerebbe latenza e un livello di traduzione su un dato che è già delicato.

### Modello

Per ogni operatore che dà il consenso, due flussi distinti e asimmetrici:

**In uscita (TB → Google).** Un calendario dedicato `TurboBooking — <nome operatore>` creato da noi nell'account dell'operatore. Ogni appuntamento confermato genera un evento con:

```json
"extendedProperties": { "private": {
   "tb_appointment_id": "…", "tb_venue_id": "…", "tb_version": "7"
}}
```

`tb_version` è il contatore di modifica dell'appuntamento in TB: risolve le riscritture fuori ordine (un job lento non deve poter sovrascrivere uno stato più recente).

**In ingresso (Google → TB).** Gli altri calendari dell'operatore (personale, ecc.) vengono letti **solo come occupazione**: ogni evento diventa una riga in `external_busy_blocks` che sottrae disponibilità. **Non genera mai un appuntamento.** Un evento "Dentista" nel calendario personale di Gianluca deve rendere Gianluca non prenotabile, non creare un cliente di nome Dentista.

Meccanismo: `events.watch` per le notifiche push + `syncToken` per il delta incrementale. Il canale di watch scade (giorni): serve un job di rinnovo che gira **prima** della scadenza, con `integration_connections.channel_expires_at` come sorgente. Su `410 GONE` il `syncToken` è invalido → resync completo della finestra rilevante.

Per privacy, di default si importa **solo il free/busy** (via l'endpoint FreeBusy), non i titoli. Il titolo si sincronizza solo se l'operatore lo abilita esplicitamente.

### Conflitti

| Situazione | Comportamento |
|---|---|
| Evento esterno si sovrappone a un appuntamento TB esistente | L'appuntamento **resta**. Si crea una riga in `agenda_conflicts` e un badge in agenda. Nessuna cancellazione automatica. |
| Evento TB modificato su Google (spostato a mano) | La modifica viene **respinta e riallineata** al prossimo sync: TB è master. L'operatore riceve una notifica che spiega perché. |
| Evento TB cancellato su Google | Idem: ricreato. Cancellare si fa da TurboBooking. |
| Operatore revoca l'accesso | `status='revoked'`, gli `external_busy_blocks` di quell'operatore si eliminano, la disponibilità torna a dipendere solo dai turni. Avviso al titolare. |

La regola "TB è sempre master sugli eventi che possiede" è più rigida di un vero sync bidirezionale, ma è l'unica compatibile con i vincoli `EXCLUDE`: un evento spostato su Google potrebbe sovrapporsi a un altro appuntamento, e non esiste un modo sensato di risolverlo automaticamente senza danneggiare un cliente reale.

### Verifica OAuth

Lo scope `calendar` è classificato come *sensitive* da Google e richiede la verifica dell'app (settimane di lead time, informativa privacy pubblicata, dominio verificato). **Va avviata all'inizio della Fase 1**, non quando il codice è pronto: è la dipendenza esterna con il lead time più lungo dell'intero progetto insieme alla certificazione fiscale.

## 4.4 Meta (Instagram / Facebook)

Interamente delegata a GHL:

- **Messaggi** Instagram Direct e Messenger: canali della Location, stesso flusso conversazionale di §4.2.
- **Pulsante "Prenota"** su pagina Facebook e profilo Instagram: link alla nostra pagina di prenotazione pubblica (o al funnel GHL che la incorpora).

**Non** si usano i calendari nativi di Meta: non conoscono i segmenti e produrrebbero prenotazioni non rispettose dei vincoli.

Il ritorno all'API Graph diretta resta possibile e circoscritto a una classe `NotificationChannel` più un handler di webhook.

## 4.5 BetterCallQ — il receptionist telefonico AI

È il consumatore più esigente: opera in tempo reale mentre un essere umano è al telefono e aspetta una risposta.

### Contratto

Autenticazione **OAuth2 client_credentials** su `api_clients`, con scope `booking:read booking:write customers:read`. Mai un token utente, mai una API key condivisa. `allowed_venue_ids` limita il raggio d'azione del client.

Sequenza tipica di una chiamata:

```
1. GET  /v1/customers/lookup?phone=+39...        → identifica il chiamante (< 50 ms)
2. GET  /v1/availability?service_ids=…&from=…&to=…&staff_id=…
                                                 → slot proposti  (< 250 ms p95)
3. POST /v1/bookings/holds                       → blocca lo slot mentre parla
4. POST /v1/bookings/{id}/confirm                → conferma
   oppure il hold scade da solo dopo 7 minuti
```

### Requisiti specifici, non negoziabili

- **Budget di latenza p95 250 ms** su `/availability`. Servito dalle maschere in Redis (§02). Sopra il secondo, la conversazione telefonica si rompe.
- **`Idempotency-Key` obbligatorio** su tutte le POST. Una chiamata che cade e viene ritentata non deve produrre due prenotazioni. La chiave è persistita su `appointments.idempotency_key` con indice univoco: la garanzia è nel database.
- **409 con alternative.** Se lo slot è stato appena preso, la risposta non è un errore secco ma contiene `suggested_alternatives`: l'agente deve poter dire "quello è appena andato, le va bene alle 15:30?" senza un altro round-trip.
- **Risposte parlabili.** Il payload include un campo pronto per la sintesi vocale (`"sabato 12 alle tre e mezza del pomeriggio con Gianluca"`), non solo un ISO 8601. Formattare date in italiano parlato è logica di dominio, ed è meglio farla una volta lato server che in ogni client.
- **Il numero chiamante identifica il cliente** ma non lo autentica. Nessun dato sensibile (note tecniche, storico patologie) è esposto su questo canale, per nessuno scope: chiunque può spoofare un numero.
- **Webhook in uscita** verso BetterCallQ su `appointment.updated` / `appointment.cancelled`, così l'agente conosce lo stato reale se richiama lo stesso cliente.

### Perché non passa da GHL

BetterCallQ ha bisogno di disponibilità reale, calcolata sui segmenti, con latenza sub-250ms e semantica di hold. GHL non offre nessuna delle tre cose. Parla direttamente con la nostra API, che è precisamente ciò per cui il sistema viene costruito.

## 4.6 Integrazione hardware fiscale

Non è un'integrazione cloud ma vale lo stesso principio di isolamento.

Registratore telematico (Epson FP-81II, Custom) raggiunto via **agent locale** installato nel salone che espone un endpoint su rete locale (protocollo ePOS-Device/XML). Il browser parla con l'agent, non con il cloud: la stampante fiscale è in LAN e non deve essere esposta a Internet.

- Interfaccia `FiscalPrinter` con implementazioni per modello. Il POS non conosce il modello di stampante.
- **Modalità degradata obbligatoria:** se la stampante non risponde, la vendita si registra comunque con `receipts.fiscal_status = 'failed'` e finisce in una coda di riemissione. Un salone non può smettere di incassare perché una stampante è offline, e un incasso non registrato è un problema peggiore di uno scontrino da riemettere.
- Ogni tentativo è tracciato: `fiscal_error`, numero documento, matricola.

## 4.7 Regole comuni a ogni integrazione

1. **Ogni webhook in ingresso si persiste prima di essere processato** (`inbound_webhooks`), con verifica della firma e deduplica sull'id evento del provider. Rende possibile il replay dopo un bug, senza chiedere al fornitore di rimandare.
2. **Ogni evento in uscita nasce dall'outbox**, mai da una chiamata diretta post-commit.
3. **Ogni chiamata esterna è idempotente o resa tale** da una chiave nostra.
4. **Nessuna integrazione è nel percorso critico di una scrittura di dominio.** Se GHL, Google o Stripe sono giù, l'agenda funziona.
5. **Ogni provider ha una pagina di stato in-app** ("Google Calendar: ultimo sync 2 min fa · 1 conflitto") . Un'integrazione silenziosamente rotta è peggio di un'integrazione assente, perché il salone continua a fidarsene.
