# 06 — Roadmap

**Assunzione di dimensionamento:** 2 sviluppatori backend + 1 frontend + 1 full-stack. Le durate sono in settimane-calendario con questo organico; vanno riscalate se l'organico cambia. Non sono stime contrattuali ma ordini di grandezza per sequenziare le decisioni.

## Fase 0 — Fondamenta (3-4 settimane)

Non produce funzionalità visibili, e per questo è la fase che si è più tentati di saltare. Saltarla significa riscriverla dopo con dati in produzione.

- Monorepo, CI, ambienti (dev/staging/prod in UE), Docker.
- Schema DB + migrazioni + **RLS con test di integrazione che provano l'isolamento** (un test che tenta l'accesso cross-tenant e deve fallire).
- Auth: JWT + refresh rotante, RBAC, mascheramento campi.
- `packages/booking-core`: il motore a maschere, puro, con la sua suite di test.
- Outbox + worker BullMQ + osservabilità.
- **Design system estratto dagli screenshot Treatwell** in `foto-treatwellpro/`: token, griglia, tipografia, componenti base. Da fare prima delle schermate, non durante.

> **Da avviare in parallelo il primo giorno**, perché hanno lead time esterni che nessuna accelerazione interna può comprimere: verifica OAuth Google, app Marketplace GoHighLevel, valutazione fornitori per RT e intermediario SDI, richiesta di portabilità dati a Treatwell (§03.5).

**Criterio di uscita:** un test end-to-end crea due organizzazioni, prenota su entrambe, e dimostra che nessuna vede i dati dell'altra; il motore slot passa i casi limite di §02.4.

## Fase 1 — MVP operativo (8-10 settimane)

**Obiettivo: il salone può smettere di usare Treatwell per l'agenda.** Tutto il resto viene dopo.

| Blocco | Contenuto |
|---|---|
| Trattamenti | Servizi, categorie, **segmenti** (processing/posa/finishing/sanificazione), pacchetti |
| Staff | Schede, turni, ferie/permessi, servizi abilitati con prezzo e durata custom |
| Postazioni | Risorse prenotabili |
| Orari | Standard, aperture e chiusure straordinarie |
| **Agenda** | Vista giorno/settimana multi-operatore, drag&drop, creazione rapida, note tecniche, ricerca cliente inline, SSE |
| Rubrica | Anagrafica, storico, note, consensi, import CSV |
| Prenotazione | Motore disponibilità, hold, conferma, riprogrammazione, cancellazione |
| Booking pubblico | Pagina prenotazione white-label |
| Google Calendar | Sync bidirezionale con le regole di §04.3 |
| GHL — base | Sync contatti + **conferma e promemoria transazionali** |
| **API BetterCallQ** | `/availability`, `/holds`, `/confirm`, `/customers/lookup` |

**Due anticipi rispetto alla priorità originaria, entrambi motivati:**

1. **Notifiche in Fase 1, non in Fase 3.** Con GHL come trasporto, conferma e promemoria costano ~1 settimana invece di ~4. Sono anche ciò che riduce i no-show dal primo giorno: rimandarle a Fase 3 significherebbe far girare il salone per mesi con un sistema percepito come inferiore a Treatwell proprio dove Treatwell è visibile al cliente finale.
2. **API BetterCallQ in Fase 1.** È il motivo strategico del progetto e, una volta esistente il motore di disponibilità, è essenzialmente gratuita: sono gli stessi endpoint del booking pubblico con autenticazione M2M.

**Criterio di uscita:** una settimana reale del salone gestita in parallelo su TurboBooking e Treatwell, con riconciliazione a fine settimana e zero divergenze sull'agenda.

## Fase 2 — Cassa e magazzino (8-10 settimane)

**Obiettivo: il salone può spegnere Treatwell.** È la fase che richiede più attenzione perché tocca il denaro e il fisco.

| Blocco | Contenuto |
|---|---|
| Cassa | Apertura/chiusura, movimenti contanti, quadratura, Z-report |
| Checkout | Split payment, sconti, promozioni, gift card, abbonamenti |
| Fiscale | Agent locale + RT, scontrino telematico, **modalità degradata**, riemissione |
| Corrispettivi | Report giornaliero con lo schema di §03.4 |
| Fatturazione | XML FatturaPA, invio via intermediario, esiti SDI, conservazione |
| Magazzino | Prodotti, giacenze, movimenti, doppia destinazione (rivendita / uso tecnico) |
| Scarico automatico | Da servizio erogato e da vendita retail |
| Fornitori | Fornitori, produttori, spedizioni, ordini d'acquisto, scadenzario |
| Spese | Registro spese operative |
| Loyalty | Punti, gift card, abbonamenti a token |

**Criterio di uscita:** un mese di corrispettivi quadrati al centesimo con la contabilità del commercialista del salone. Non "il software funziona": **i numeri tornano**.

## Fase 3 — Canali e automazione (6-8 settimane)

| Blocco | Contenuto |
|---|---|
| GHL completo | Workflow di riattivazione, compleanno, win-back, richiesta recensione |
| Segmentazione | Worker RFM, pubblicazione tag e custom field |
| WhatsApp | Booking conversazionale (§04.2) |
| Instagram / Messenger | Stesso motore, trasporto diverso |
| BetterCallQ | Integrazione piena, webhook in uscita, escalation a umano |
| Caparre | Stripe, pre-autorizzazione, addebito no-show |
| Recensioni | Interne + Google via GHL, risposte |
| App staff | Expo, agenda personale, dati mascherati |
| Comunicazioni | Invio massivo dal gestionale, credito residuo |

**Criterio di uscita:** una prenotazione completata interamente via WhatsApp senza intervento umano, e una via telefono con BetterCallQ, entrambe correttamente a calendario con i segmenti giusti.

## Fase 4 — Intelligenza (6-8 settimane)

| Blocco | Contenuto |
|---|---|
| Viste materializzate | Le cinque di §03.4 |
| Read replica | Tutti i report ci puntano |
| Dashboard | Analisi Andamento, Report Azienda con confronti di periodo |
| Report Collaboratori | Occupazione, fiche media, fidelizzazione, recensioni |
| Report Clienti | Nuovi/Di ritorno/Persi/Recuperati, coorti, frequenza |
| Report Magazzino | Rotazione, non movimentate, morte, da ordinare |
| Report Inventario | Vista storica a data arbitraria |
| Redditività | Margine per servizio combinando costo personale e prodotti |
| Multisede | Consolidamento cross-venue |
| E-commerce | Catalogo pubblico, carrello, checkout retail |

**Criterio di uscita:** il titolare prende una decisione operativa reale (listino, turni, riordino) guardando un report di TurboBooking.

## Sintesi temporale

```
        M1   M2   M3   M4   M5   M6   M7   M8   M9   M10  M11
Fase 0  ███
Fase 1       ███████████
Fase 2                   ███████████
Fase 3                                ████████
Fase 4                                         ████████
Lead-time esterni ▓▓▓▓▓▓▓▓▓▓▓ (Google, GHL, RT, SDI, portabilità dati)
```

Go-live sull'agenda a fine Fase 1 (~M4), spegnimento di Treatwell a fine Fase 2 (~M7). **Il periodo di parallelo fra i due sistemi va pianificato e messo a budget**: il salone lavorerà due volte per alcune settimane, e non saperlo in anticipo è il modo più affidabile di far fallire l'adozione.

## Cosa resta deliberatamente fuori

- **Masterclass** — contenuti formativi di terze parti, nessun valore per il cliente.
- **Motore di campagne proprio** — è GHL.
- **App cliente nativa** — la pagina web di prenotazione è sufficiente; un'app che il cliente usa tre volte l'anno non viene installata.
- **Sharding multi-tenant, ClickHouse, microservizi** — complessità senza ritorno sotto le centinaia di saloni.
