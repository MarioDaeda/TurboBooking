# 02 — Booking Engine: modello temporale e algoritmo

Questo è il modulo che determina se il prodotto funziona. Tutto il resto (POS, magazzino, BI) è CRUD con regole di business; qui c'è l'unico problema algoritmico vero.

## 2.1 Il servizio non ha una durata: ha una forma

Modellare un servizio con `durata = 75 min` è l'errore che rende inutilizzabile un gestionale per parrucchieri. Un "Colore radice" reale è:

```
t=0                20min            50min              75min
├── PROCESSING ────┼─── LAY ────────┼─── FINISHING ────┤
│  applicazione    │   posa         │  piega/asciuga   │
│  operatore: SÌ   │  operatore: NO │  operatore: SÌ   │
│  postazione: SÌ  │  postazione: SÌ│  postazione: SÌ  │
└──────────────────┴────────────────┴──────────────────┘
                                                        ├─ SANIT. ─┤
                                                         post-serv.
                                                        operatore: NO
                                                        postazione: SÌ
```

Nei 30 minuti di posa **l'operatore è libero e deve poter essere prenotato da un altro cliente**. È esattamente così che un salone raddoppia la propria capacità produttiva. Un sistema che blocca l'operatore per 75 minuti consecutivi fa perdere al salone soldi veri ogni giorno, e sarà abbandonato entro una settimana.

### Modello dati

Un servizio è una **sequenza ordinata di segmenti**:

```
services (1) ──< (N) service_segments
                     ├── ordinal          smallint
                     ├── kind             processing | lay | finishing | sanitation
                     ├── duration_minutes int
                     ├── blocks_staff     boolean
                     ├── blocks_resource  boolean
                     └── staff_role       (opzionale: quale figura serve)
```

Questo generalizza i "3+1 segmenti" della specifica: un taglio semplice ha un solo segmento `processing`; una permanente può averne sette. Il `tempo di sanificazione` è semplicemente un segmento finale con `blocks_staff = false, blocks_resource = true` — nessun campo speciale, nessun ramo `if` nell'algoritmo.

Il segmento `lay` è modellato come **occupazione continua della risorsa fisica** e non-occupazione dell'operatore. Non è un "buco": la poltrona resta legittimamente occupata e va sottratta dalla capacità.

### Prezzi e durate per operatore

`staff_services` sovrascrive prezzo **e** durate per singolo operatore (un senior fa la stessa piega in 30' invece che 45'). Le durate custom sono per-segmento, non globali: `staff_service_segment_overrides`. Se assente l'override, vale il default del servizio.

## 2.2 L'appuntamento è un insieme di segmenti, non un intervallo

```
appointments (1) ──< (N) appointment_segments
                          ├── during        tstzrange   ← intervallo reale, UTC
                          ├── staff_id      uuid NULL   ← NULL durante la posa
                          ├── resource_id   uuid NULL
                          ├── blocks_staff / blocks_resource
                          └── is_blocking   boolean     ← denormalizzato da status
```

L'header `appointments` porta cliente, stato, prezzo, origine (`source`: direct / whatsapp / instagram / phone_ai / web). Le righe `appointment_segments` sono ciò su cui il database garantisce l'assenza di conflitti.

## 2.3 Non-overbooking: garanzia a livello DBMS

```sql
CREATE EXTENSION btree_gist;

ALTER TABLE appointment_segments
  ADD CONSTRAINT no_staff_overlap
  EXCLUDE USING gist (staff_id WITH =, during WITH &&)
  WHERE (is_blocking AND blocks_staff AND staff_id IS NOT NULL),

  ADD CONSTRAINT no_resource_overlap
  EXCLUDE USING gist (resource_id WITH =, during WITH &&)
  WHERE (is_blocking AND blocks_resource AND resource_id IS NOT NULL);
```

**Cosa compra questo vincolo.** Due `INSERT` concorrenti che si sovrappongono sullo stesso operatore: uno committa, l'altro riceve `23P01 exclusion_violation` e fallisce. Non c'è finestra di race, non c'è lock da rilasciare, non c'è codice applicativo da non dimenticare. Vale identicamente per la prenotazione da web, da WhatsApp, dall'agenda e da BetterCallQ — **inclusa la migrazione dati e le query manuali in psql**.

Il `WHERE` parziale è ciò che rende il modello espressivo:
- i segmenti di posa (`blocks_staff = false`) non partecipano al vincolo staff → l'operatore resta prenotabile;
- gli appuntamenti cancellati/no-show (`is_blocking = false`) liberano lo slot senza essere cancellati fisicamente (servono per statistiche e storico).

`is_blocking` è denormalizzato da `appointments.status` perché un vincolo `EXCLUDE` non può leggere una tabella esterna. Va tenuto allineato da un **trigger** su `appointments` (fornito in `db/schema.sql`) — non dal codice applicativo, che prima o poi dimenticherà un percorso.

### Il "lock" di checkout

Non serve un lock Redis per la correttezza. Il flusso è:

1. Il client chiede uno **hold**: `POST /v1/bookings/holds` crea un `appointment` con `status='hold'` e `hold_expires_at = now() + 7 min`, con i suoi segmenti `is_blocking = true`.
2. Se lo slot è già occupato, l'`INSERT` fallisce **immediatamente e atomicamente**. Nessuna ambiguità.
3. Il checkout promuove `hold → confirmed`.
4. Un job BullMQ ogni 60s marca `is_blocking = false` sugli hold scaduti.

Un lock Redis *aggiuntivo* resta utile solo come segnale UX ("Marco sta prenotando questo slot") nell'agenda condivisa in tempo reale, e la sua perdita non ha conseguenze.

## 2.4 Ricerca disponibilità: maschere di bit

### Rappresentazione

La giornata di una sede è discretizzata in slot di `slot_granularity_minutes` (default 5 → 288 slot/giorno). Ogni entità diventa un **bitmask** dove il bit *i* = "lo slot *i* è libero".

```
apertura salone   1111111111111111110000000011111111111111  (chiuso 13:00-14:00)
staff Gianluca    0011111111111111111111111111111100000000  (turno 09:00-18:00)
ferie/permessi    1111111111000000001111111111111111111111  (permesso 11:00-13:00)
già prenotato     1111100011111111111111100011111111111111
Google Calendar   1111111111111111111111100000011111111111  (evento esterno)
                  ────────────────────────────────────────
staff_free = AND  0011100000000000000000000000111100000000
```

E in parallelo la maschera della risorsa fisica (postazione), calcolata allo stesso modo.

**Perché bitmask e non query SQL per ogni slot.** Una ricerca "primo slot disponibile nelle prossime 3 settimane per 4 operatori" con approccio SQL naive fa migliaia di query di overlap. Con maschere: 21 giorni × 4 operatori = 84 interi da 288 bit, caricati da Redis e intersecati con operazioni AND — **microsecondi**. È ciò che rende raggiungibile il budget di latenza V3 per BetterCallQ.

Implementazione: `BigInt` in Node (nativo, operatori bitwise arbitrariamente lunghi), persistito in Redis come `bytea`/base64 con chiave `mask:{venue}:{date}:{staff|resource}:{id}`.

### Matching di un servizio multi-segmento

Per un servizio con segmenti `[P:20, L:30, F:25]` e slot da 5' → pattern `[4, 6, 5]` slot.
Per ogni possibile istante di inizio *t*:

```
candidato(t) valido  ⟺
    staff_free    ha 4 bit consecutivi liberi da t              (processing)
  ∧ resource_free  ha 12 bit consecutivi liberi da t            (tutto il servizio)
  ∧ staff_free    ha 5 bit consecutivi liberi da t+10           (finishing)
```

Nota che sui 6 slot di posa **non si richiede nulla all'operatore**: è lì che nasce l'interleaving. Il calcolo si esprime come AND di maschere shiftate:

```
inizi_validi = ⋀(k=0..3) (staff_free >> k)          // processing
             ∧ ⋀(k=0..11) (resource_free >> k)      // intera durata
             ∧ ⋀(k=10..14) (staff_free >> k)        // finishing
```

Ogni bit a 1 nel risultato è un orario di inizio proponibile. Costo: O(durata_totale_in_slot) shift, indipendente dal numero di appuntamenti esistenti.

### Casi che l'algoritmo deve gestire fin dal design

| Caso | Trattamento |
|------|-------------|
| **Servizi concatenati** (taglio + colore, stesso cliente) | Si concatenano i pattern; opzione "stesso operatore" o "operatore qualsiasi" per il secondo. Gap massimo tollerato configurabile. |
| **Interleaving durante la posa** | Emerge gratuitamente dal modello. Va però esposto un flag per-servizio `allow_interleaving` (alcuni titolari non lo vogliono). |
| **Servizio a 2 operatori** (es. quattro mani) | Il segmento porta `required_staff_count`; il matching richiede 2 maschere staff distinte simultaneamente libere. **Da progettare in Fase 1, implementare in Fase 2.** |
| **Cambio di ora legale** | Le maschere si costruiscono in **ora locale della sede**, `during` si persiste in UTC. Il 26 ottobre la giornata locale ha 25 ore → 300 slot, il 29 marzo ne ha 23 → 276. Un array a lunghezza fissa qui produce bug silenziosi. |
| **Chiusura straordinaria che taglia un appuntamento esistente** | La chiusura non cancella: genera un **conflitto** in una coda `agenda_conflicts` che il receptionist risolve manualmente. Cancellare automaticamente appuntamenti di clienti reali è inaccettabile. |
| **Sede su più fusi orari** (multisalone) | `venue.timezone` obbligatorio, mai `TZ` del server. |

### Invalidazione della cache

Le maschere in Redis sono derivate. Vengono invalidate da eventi (`appointment.*`, `staff_absence.*`, `venue_hours.*`, `external_calendar.busy_changed`) consumati dal worker, con TTL di sicurezza di 15 minuti e **ricostruzione lazy** al primo miss. Il ricalcolo di una giornata/operatore è una singola query indicizzata: la cache è un'ottimizzazione, mai una fonte di verità.

**Regola difensiva:** prima di confermare, il flusso rilegge sempre da Postgres tramite l'`INSERT` con `EXCLUDE`. La cache può proporre uno slot stantio; il database rifiuterà. Il client riceve `409 Conflict` con la lista di slot alternativi aggiornati — comportamento particolarmente importante per BetterCallQ, che deve poter dire al telefono "quello è appena stato preso, le va bene alle 15:30?".

## 2.5 Macchina a stati dell'appuntamento

```
                  ┌──────────────┐
                  │     hold     │ (TTL 7 min, is_blocking = true)
                  └──────┬───────┘
             scade ──────┤────── conferma
                  ▼      ▼
            ┌─────────┐  ┌───────────┐
            │ expired │  │  pending  │ (richiede approvazione salone)
            └─────────┘  └─────┬─────┘
                               ▼
                        ┌─────────────┐
                        │  confirmed  │◄──── riprogrammazione
                        └──┬───┬───┬──┘
                           │   │   └────────────┐
                    ▼      ▼   ▼                ▼
             ┌────────────┐ ┌──────────┐ ┌──────────┐
             │in_progress │ │cancelled │ │ no_show  │
             └─────┬──────┘ └──────────┘ └──────────┘
                   ▼           is_blocking = false
             ┌───────────┐
             │ completed │ → genera riga di cassa, scarica magazzino,
             └───────────┘   accredita punti loyalty, sblocca recensione
```

`is_blocking = true` per: `hold`, `pending`, `confirmed`, `in_progress`, `completed`.
`is_blocking = false` per: `expired`, `cancelled`, `no_show`.

Ogni transizione scrive in `appointment_events` (chi, quando, da quale canale) — indispensabile per la ricostruzione dei casi contestati e per il calcolo del tasso di no-show per cliente.

## 2.6 Sorgenti di indisponibilità: elenco completo

Il motore deve intersecare, per ogni operatore/risorsa:

1. `venue_business_hours` — orario ricorrente settimanale
2. `venue_hour_exceptions` — aperture **e** chiusure straordinarie (tipo + intervallo)
3. `staff_schedules` — turni settimanali dell'operatore (≠ orario salone)
4. `staff_absences` — ferie/permessi puntuali con data-ora inizio/fine
5. `appointment_segments` — occupazione da prenotazioni
6. `external_busy_blocks` — eventi provenienti da Google Calendar (§04)
7. `resource_downtime` — postazione fuori servizio (manutenzione)
8. `booking_rules` — regole di policy: preavviso minimo, orizzonte massimo, buffer fra appuntamenti, blocco di servizi lunghi nelle fasce di punta

Il punto 8 non è disponibilità fisica ma **politica commerciale**, e va tenuto in un layer separato applicato *dopo* l'intersezione: le stesse maschere servono all'agenda interna (dove il receptionist può forzare) e al booking pubblico (dove le regole si applicano). Confondere i due livelli significa non poter più prenotare a mano un cliente per domani mattina.

## 2.7 Perimetro rispetto a GoHighLevel

Il motore descritto in questo capitolo **non è delegabile a GHL** e non deve avere alcuna dipendenza da esso.

- I calendari GHL non partecipano al calcolo della disponibilità: non sono una delle otto sorgenti di §2.6.
- Gli appuntamenti vengono replicati verso GHL **in sola scrittura**, per dare ai workflow di marketing il contesto necessario (chi, quando, quale servizio, quale operatore). Il ritorno di scrittura da GHL verso l'agenda è **disabilitato**: un appuntamento creato dentro GHL non può rispettare i vincoli di segmento e risorsa, quindi non deve poter esistere.
- La prenotazione via WhatsApp/Instagram passa da GHL come **trasporto del messaggio**, ma l'interrogazione della disponibilità e la creazione dell'hold restano chiamate alla nostra API (§04). GHL trasporta, TurboBooking decide.
