# 03 — Modello dati

Lo schema completo è in [`db/schema.sql`](../db/schema.sql). Qui ci sono le decisioni che lo schema da solo non spiega.

## 3.1 Mappa delle entità

```
organizations
 └─ venues ─────────────────────────────────────────────────────────┐
     ├─ venue_business_hours / venue_hour_exceptions / booking_rules │
     ├─ resources ─ resource_downtime                                │
     ├─ staff ─ staff_schedules / staff_absences                     │
     │    └─ staff_services ─ staff_service_segment_overrides        │
     ├─ services ─ service_segments                                  │
     │    ├─ service_categories                                      │
     │    ├─ service_product_usage → products                        │
     │    └─ service_packages ─ service_package_items                │
     ├─ appointments ────────────────────────────────────────────────┤
     │    ├─ appointment_services  (i trattamenti prenotati)         │
     │    ├─ appointment_segments  ⭐ vincoli EXCLUDE                 │
     │    └─ appointment_events    (audit di stato)                  │
     ├─ cash_registers ─ cash_register_sessions ─ cash_movements     │
     │    └─ receipts ─ receipt_lines / payments / einvoices         │
     ├─ products ─ stock_items / stock_movements                     │
     │    └─ purchase_orders ─ purchase_order_lines                  │
     ├─ suppliers ─ supplier_shipping_options    manufacturers       │
     ├─ expenses                                                     │
     └─ reviews ─────────────────────────────────────────────────────┘

customers (a livello organization, condivisi fra sedi)
 ├─ customer_consents          base giuridica per ogni finalità
 ├─ customer_notes    ⚠ art.9  formule, allergie, note tecniche
 ├─ customer_media    ⚠ art.9  foto prima/dopo
 ├─ loyalty_wallets ─ loyalty_transactions
 ├─ customer_packages ─ customer_package_tokens
 └─ gift_cards

trasversali: external_refs · outbox_events · inbound_webhooks ·
             integration_connections · notification_messages ·
             external_busy_blocks · agenda_conflicts · audit_log
```

## 3.2 Sei decisioni strutturali

**1. Il denaro è `bigint` in centesimi.** Il frontend è JavaScript: `numeric` di Postgres arriva come stringa (e chi lo converte con `Number()` introduce errori) oppure come float (e allora `0.1 + 0.2`). I centesimi interi eliminano la classe di bug. Solo percentuali e quantità usano `numeric`.

**2. Ogni saldo è derivato da un libro mastro.** `stock_items.quantity` deriva da `stock_movements`; `loyalty_wallets.points_balance` da `loyalty_transactions`; il residuo di un abbonamento è il conteggio dei `customer_package_tokens` non consumati. Un saldo scritto direttamente è un saldo che prima o poi diverge e che nessuno sa più ricostruire. Corollario operativo: si può sempre rispondere a "perché mancano 3 pezzi?" — e questa è la prima domanda che fa un titolare.

**3. Il consumo di abbonamento è un token, non un contatore.** `UPDATE ... SET consumed_at = now() WHERE id = ? AND consumed_at IS NULL` è atomico e riporta 0 o 1 riga. Un `contatore = contatore - 1` sotto concorrenza consuma due prestazioni per una.

**4. Gli id esterni stanno in `external_refs`, non nelle tabelle di dominio.** Con GHL, Google, Stripe, Meta e in futuro altro, la scelta alternativa (`ghl_contact_id`, `google_event_id`, `stripe_customer_id`… su `customers`) porta a una tabella che cresce a ogni integrazione e a migrazioni per ogni fornitore aggiunto. `external_refs` porta anche lo stato di sincronizzazione, che serve per diagnosticare i disallineamenti — la categoria di ticket più frequente nei sistemi integrati.

**5. I dati art. 9 sono confinati in due tabelle.** `customer_notes` e `customer_media`. Non sparsi in campi note su `customers` o `appointments`. Questo rende implementabili in modo verificabile: la cifratura a livello di colonna, l'audit di ogni lettura, l'esclusione dai payload verso l'esterno, e la risposta a una richiesta di accesso o cancellazione. Se le allergie finissero anche in `appointments.internal_note`, nessuna di queste garanzie sarebbe più dimostrabile.

**6. Nessuna cancellazione fisica dei clienti.** `customers.deleted_at` (soft delete). Il diritto all'oblio (art. 17) confligge con l'obbligo civilistico di conservazione decennale dei documenti fiscali: la ricevuta va conservata, l'anagrafica va cancellata. La procedura è **anonimizzazione**: si azzerano nome, telefono, email, note e media; si conserva l'id sulle ricevute. Documentata in §07.

## 3.3 Le metriche denormalizzate su `customers`

`visits_count`, `lifetime_value_cents`, `avg_ticket_cents`, `last_visit_at`, `rfm_segment` sono ridondanti: ricavabili da `receipts` e `appointments`. Sono lì perché la Rubrica deve poter ordinare e filtrare 10.000 clienti per "scontrino medio" o "persi da oltre 90 giorni" senza aggregare a ogni pagina.

Aggiornamento: worker notturno `crm-metrics` + aggiornamento incrementale sull'evento `receipt.issued`. Non trigger: un trigger su `receipts` che aggiorna `customers` crea contesa su riga durante la chiusura di cassa, il momento di massima concorrenza della giornata.

### Segmentazione RFM

Il worker classifica ogni cliente su tre assi calcolati **per percentile all'interno del salone** — le soglie assolute non funzionano perché un barbiere e un centro estetico hanno frequenze e scontrini incomparabili:

| Segmento | Regola | Uso |
|---|---|---|
| `new` | prima visita negli ultimi 30 gg | benvenuto, seconda visita |
| `champion` | R alto, F alto, M alto | early access, referral |
| `loyal` | F alto, R medio | programma punti |
| `at_risk` | R oltre 1,5× la sua frequenza abituale | riattivazione |
| `lost` | R oltre 3× la frequenza abituale, o > soglia salone | campagna win-back |

La **frequenza abituale è personale**, non globale: un cliente che viene ogni 8 settimane è "a rischio" alla dodicesima, mentre uno mensile lo è già alla settima. Una soglia unica per tutto il salone produce liste inutilizzabili e brucia il canale.

Il risultato viene pubblicato verso GHL come tag (`tb_segment_at_risk`) e custom field, dove i workflow lo consumano (§04). **Il calcolo resta nostro perché i dati transazionali sono nostri**; GHL vede solo la conclusione.

Le metriche del Report Clienti di Treatwell (Nuovi / Di ritorno / Persi / Recuperati, frequenza di ritorno, fiche media, servizi per fiche, distribuzione per sesso) si derivano tutte da questi campi + `receipts`.

## 3.4 Viste per la reportistica

Da creare come viste materializzate rinfrescate di notte (Fase 2):

| Vista | Alimenta |
|---|---|
| `mv_daily_revenue` | Analisi Andamento, Report Azienda: ricavi totali, servizi, prodotti, promozioni, presenze, fiche media, servizi per fiche, % rivendita su presenze |
| `mv_daily_fiscal` | Corrispettivi: imponibile lordo/netto, servizi, rivendita, promozioni, fatture, numero ricevute |
| `mv_staff_performance` | Report Collaboratori: fiche media, servizi per fiche, tasso di occupazione (ore fatturate / ore turno da `staff_schedules`), fidelizzazione nuovi vs esistenti, media recensioni |
| `mv_customer_cohorts` | Report Clienti: coorti mensili, retention, frequenza di ritorno |
| `mv_inventory_health` | Report Magazzino: rotazione in giorni, referenze non movimentate, referenze morte, da ordinare |

**Nota su "Report Inventario" (vista storica a una data).** Non serve una tabella di snapshot: `stock_movements` è un libro mastro, quindi la giacenza a una data qualsiasi è `SUM(quantity_delta) WHERE created_at <= data`. È l'unico modo per non dover decidere in anticipo quali date archiviare, ed è un'altra conseguenza gratuita della decisione 2.

## 3.5 Migrazione dei dati da Treatwell

Va progettata subito perché **condiziona il go-live**, non alla fine.

Treatwell Pro non espone API. Le vie praticabili, in ordine di preferenza:

1. **Export CSV dall'interfaccia** (Rubrica ha un export dichiarato). Copre l'anagrafica clienti: il dato più prezioso e quello la cui perdita bloccherebbe il passaggio.
2. **Richiesta formale di portabilità dei dati** al fornitore ex art. 20 GDPR, a nome del titolare del salone. È un diritto esercitabile e vale la pena tentarlo per lo storico appuntamenti: la risposta richiede settimane, quindi va inviata all'inizio del progetto.
3. **Reinserimento manuale** di listino, staff, orari, postazioni: sono decine di record, non migliaia. Non vale automatizzarlo.
4. Lo **storico appuntamenti**, se non ottenibile, si accetta come perdita: si parte con lo storico da zero e si conserva l'accesso in sola lettura a Treatwell per il periodo di sovrapposizione contrattuale.

Tabella `import_batches` + colonna `customers.source = 'import'` per poter isolare e rifare un import andato male. **Regola: nessun import in produzione senza dry-run che produca un diff.**

## 3.6 Volumi attesi e conseguenze

Per un salone da 6 operatori, ~120 appuntamenti/giorno:

| Tabella | Righe/anno per salone | Nota |
|---|---|---|
| `appointments` | ~35.000 | |
| `appointment_segments` | ~90.000 | 2-3 segmenti per appuntamento |
| `receipt_lines` | ~60.000 | |
| `stock_movements` | ~50.000 | |
| `audit_log` | ~500.000 | **cresce più in fretta di tutto il resto** |
| `outbox_events` | ~200.000 | |

Conseguenze da prevedere nel design, non dopo:

- `audit_log` e `outbox_events` vanno **partizionati per mese** e sottoposti a retention (24 mesi per l'audit, 7 giorni per l'outbox già pubblicato). Sono le uniche tabelle che lo richiedono in Fase 1-2.
- Le altre restano piccole per anni: nessun partizionamento anticipato. A 500 saloni, `appointment_segments` supera i 45M di righe e diventa il primo candidato al partizionamento per `venue_id`.
