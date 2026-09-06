# 07 — Rischi tecnici e vincoli normativi

Ordinati per impatto sulla riuscita del progetto, non per area tematica.

## 7.1 Vincoli normativi

### Corrispettivi telematici (rischio: alto — blocca il go-live della cassa)

Dal 2020 la memorizzazione e trasmissione telematica dei corrispettivi è obbligatoria. Il salone deve emettere **documento commerciale** tramite Registratore Telematico certificato dall'Agenzia delle Entrate.

**Implicazione architetturale decisiva: non certifichiamo noi il software.** La certificazione riguarda il dispositivo RT; noi lo pilotiamo. Questo tiene TurboBooking fuori dal perimetro di certificazione — a condizione di **non** implementare mai una "cassa software" che memorizza corrispettivi in proprio. La memorizzazione fiscale sta nel dispositivo; noi teniamo un registro gestionale, che è cosa diversa e va chiamata diversamente anche nella UI.

Da decidere in Fase 0: modello di RT supportato al lancio (uno solo, con astrazione per gli altri). Ogni modello ha il suo dialetto XML e il suo comportamento sui casi limite (resi, annulli, ventilazione IVA).

Mitigazione della **modalità degradata**: se l'RT è offline, l'incasso si registra comunque con `fiscal_status='failed'` e finisce in coda di riemissione, con un banner permanente e non ignorabile finché la coda non è vuota. Un salone che non può incassare per una stampante rotta abbandona il gestionale in giornata.

### Fattura elettronica SDI (rischio: medio)

Serve solo per la quota di clientela che chiede fattura (detrazione parrucchieri/estetica in casi specifici, clienti aziendali) e per le fatture verso i fornitori.

**Non costruiamo un canale SDI proprio.** L'accreditamento diretto richiede infrastruttura, firma digitale qualificata e conservazione a norma decennale. Si usa un **intermediario con API** (Aruba, Fatture in Cloud, Openapi): copre trasmissione, firma e conservazione sostitutiva. Costo per fattura trascurabile rispetto allo sforzo di internalizzare.

Da gestire comunque da noi: generazione XML conforme (versione corrente al momento dell'implementazione — il tracciato cambia), gestione degli **esiti** (accettata, scartata, mancata consegna) con riemissione, e numerazione progressiva senza buchi per anno e sezionale. La numerazione con buchi è un rilievo in sede di verifica: va garantita da un contatore transazionale in DB, mai da un `MAX(numero)+1` letto fuori transazione.

### GDPR — dati particolari (rischio: alto, con esposizione sanzionatoria)

Le note tecniche di un salone contengono regolarmente allergie, reazioni cutanee, gravidanze, terapie in corso. Sono **dati relativi alla salute, art. 9 GDPR**, e non è una lettura estensiva: sono raccolti proprio per la loro rilevanza sanitaria.

Conseguenze operative, tutte già riflesse nel design:

| Obbligo | Come lo soddisfiamo |
|---|---|
| Base giuridica (art. 9.2.a: consenso esplicito) | `customer_consents` con finalità `health_data` separata e tracciata |
| **DPIA** (art. 35) — trattamento su larga scala di dati art. 9 | Da redigere **prima** del go-live. Il titolare è il salone, ma il documento lo prepariamo noi: nessun parrucchiere lo farà |
| Minimizzazione | Dati art. 9 confinati in `customer_notes` / `customer_media` |
| Cifratura | A livello di colonna con chiave per tenant, in aggiunta alla cifratura at-rest del volume |
| Accountability | `audit_log` su ogni **lettura**, non solo scrittura |
| Limitazione d'accesso | Il ruolo `staff` non vede le note di clienti non suoi |
| Diritto all'oblio (art. 17) | Anonimizzazione, non delete (§7.2) |
| Portabilità (art. 20) | Export JSON/CSV completo del cliente |
| Nomina a responsabile (art. 28) | Contratto DPA salone ↔ noi, e nostro ↔ ogni sub-responsabile |

**Il divieto di esportazione verso GHL va implementato come allowlist nel mapper**, non come denylist né come convenzione. Una denylist dimentica il campo aggiunto il mese prossimo; una allowlist fallisce in modo sicuro.

### GDPR — trasferimento verso GoHighLevel (rischio: medio, va documentato)

GHL è un fornitore statunitense. Il flusso di dati personali di clienti italiani verso di esso è un trasferimento extra-UE che richiede:

- **DPA firmato** con GHL, con clausole contrattuali standard o adesione al Data Privacy Framework (verificare la certificazione corrente dell'entità che eroga il servizio, non del gruppo);
- **TIA** (Transfer Impact Assessment) sintetico;
- **GHL nominato sub-responsabile** nel DPA fra noi e il salone, con l'elenco dei sub-responsabili pubblicato e aggiornato;
- **informativa privacy del salone** che nomina esplicitamente il trasferimento;
- **nessun dato art. 9 nel flusso** — è ciò che rende l'analisi di rischio sostenibile. Se le note tecniche finissero su GHL, la valutazione cambierebbe radicalmente e servirebbe un consenso specifico al trasferimento di dati sanitari extra-UE, che nessun salone otterrà mai in modo pulito al banco.

Questo punto va chiuso **prima** della Fase 3, non durante.

### PCI-DSS (rischio: basso, se si tiene la disciplina)

Il sistema non deve mai vedere un PAN. Caparre e pagamenti online con **Stripe Elements / Payment Element**: i dati carta vanno dal browser a Stripe, noi riceviamo solo token e `PaymentIntent`. Questo colloca il salone in **SAQ-A**, l'autovalutazione più leggera.

Per l'addebito no-show serve un mandato per pagamenti *off-session* raccolto al momento della prenotazione, con SCA/3DS eseguita allora. Va comunicato con chiarezza al cliente in fase di prenotazione: un addebito inatteso genera chargeback, e un chargeback costa più della caparra.

**Regola assoluta:** nessun campo carta nel nostro DOM, nei nostri log, nei nostri database. Nemmeno "temporaneamente per debug".

### Policy WhatsApp e Meta (rischio: medio)

Gestita da GHL sul piano tecnico, ma le **conseguenze commerciali restano del salone**: un numero WhatsApp Business bloccato per invii non sollecitati interrompe il canale, e il ripristino non è garantito.

Presidi da imporre nel prodotto, non da lasciare alla buona volontà: opt-in registrato prima di qualsiasi invio marketing, template approvati per i messaggi fuori dalla finestra di 24 ore, opt-out onorato entro pochi secondi e propagato a tutti i canali, e un tetto di frequenza per contatto configurabile ma con un default prudente.

## 7.2 Rischi tecnici

### R1 — Il componente Agenda (probabilità: alta, impatto: alto)

È il pezzo di frontend più complesso del progetto e quello su cui l'utente giudica tutto il resto. Griglia multi-operatore, drag & drop con validazione in tempo reale, segmenti con buchi visibili, sovrapposizioni durante la posa, zoom temporale, performance con 200 appuntamenti a schermo.

**Mitigazione:** prototiparlo in Fase 0 con dati finti, prima di qualunque backend. Se il prototipo non regge, si scopre a settimana 3 e non a settimana 20. Budget realistico: 3-4 settimane a sé.

### R2 — Correttezza temporale (probabilità: alta, impatto: alto)

DST, orari a cavallo di mezzanotte, sedi in fusi diversi, servizi che scavalcano la chiusura. Sono bug silenziosi: non crashano, spostano un appuntamento di un'ora due volte l'anno.

**Mitigazione:** `booking-core` puro e testato con casi espliciti sulle date di cambio ora italiane; nessuna aritmetica su date fuori da quel pacchetto; `TZ=UTC` forzato su ogni processo, così una dipendenza dal fuso del server fallisce subito invece che in ottobre.

### R3 — Migrazione dati da Treatwell (probabilità: media, impatto: alto)

Nessuna API. Se l'export CSV della rubrica si rivela incompleto o lo storico non è ottenibile, il salone perde memoria commerciale e la percezione è che sia colpa del nuovo sistema.

**Mitigazione:** verificare **subito**, in Fase 0, cosa produce davvero l'export — non a ridosso del go-live. Richiesta di portabilità art. 20 inviata il primo giorno. Accettare esplicitamente e per iscritto con il cliente la perdita dello storico appuntamenti se non recuperabile.

### R4 — Dipendenza da GoHighLevel (probabilità: media, impatto: medio)

Ironia da tenere presente: il progetto nasce per uscire da una piattaforma chiusa. Adottarne un'altra senza precauzioni riprodurrebbe il problema.

**Mitigazione:** l'anti-corruption layer di §01.7 e la matrice di proprietà di §04.1. Il test che dimostra la mitigazione: **elencare cosa si perderebbe se GHL sparisse domani**. Con il design attuale: i workflow di marketing e i funnel (ricostruibili), non i dati (tutti nostri), non le conversazioni (loggate), non i contatti (master nostro).

### R5 — Adozione da parte del salone (probabilità: alta, impatto: molto alto)

Il rischio più sottovalutato in ogni progetto di sostituzione di gestionale. Il personale conosce Treatwell a memoria; ogni click in più durante una giornata piena genera resistenza, e la resistenza fa fallire il progetto indipendentemente dalla qualità del software.

**Mitigazione:** la fedeltà visiva a Treatwell non è un vezzo estetico ma il principale strumento di gestione di questo rischio — da cui la richiesta di partire dagli screenshot. In aggiunta: parallelo pianificato, formazione sul posto nella prima settimana, un canale diretto per le segnalazioni nei primi 30 giorni, e la possibilità di tornare indietro finché Treatwell è attivo.

### R6 — Prestazioni della ricerca disponibilità (probabilità: media, impatto: medio)

"Primo slot disponibile" su 6 operatori × 60 giorni × più servizi. Senza le maschere è una query pesante; con le maschere è la cache a diventare il punto critico.

**Mitigazione:** budget di latenza esplicito e misurato in CI (p95 250 ms su dataset realistico), fallback su ricalcolo SQL sempre disponibile, degradazione dell'orizzonte di ricerca invece del timeout.

### R7 — Coerenza fra sistemi (probabilità: alta, impatto: medio)

Con GHL, Google e Stripe collegati, i disallineamenti sono inevitabili: webhook persi, token scaduti, modifiche concorrenti.

**Mitigazione:** riconciliazione periodica (job notturno che confronta e segnala), `external_refs.sync_state` visibile in UI, pagina di stato integrazioni per sede. **Un'integrazione rotta in silenzio è peggio di un'integrazione assente**, perché il salone continua a contarci sopra.

### R8 — Diritto all'oblio vs conservazione fiscale (probabilità: media, impatto: medio)

Un cliente chiede la cancellazione; le sue ricevute vanno conservate dieci anni.

**Procedura da implementare** (non da improvvisare al primo reclamo): azzeramento di nome, telefono, email, data di nascita, indirizzo, note e media; `customers.deleted_at` valorizzato; le ricevute conservano l'`id` e i dati fiscali obbligatori ma non i dati identificativi eliminabili; log dell'operazione in `audit_log`; conferma scritta all'interessato entro 30 giorni. La cancellazione fisica della riga **non** è mai un'opzione: romperebbe l'integrità referenziale dei documenti fiscali.

## 7.3 Le sei decisioni da prendere prima di scrivere codice

1. **Modello di RT** supportato al lancio e fornitore dell'agent locale.
2. **Intermediario SDI**.
3. **Una Location GHL per sede** — confermato in §04.2, ma va validato con i costi di licenza GHL per Location.
4. **Chi è titolare del trattamento** per i dati clienti: il salone (probabile) o noi. Determina l'intera struttura contrattuale e le informative.
5. **Ambito del parallelo Treatwell**: quante settimane, chi inserisce due volte, chi paga quel tempo.
6. **Cosa fare dello storico appuntamenti** se la portabilità viene negata.

Le prime tre sono tecniche e sbloccano la Fase 2. Le ultime tre sono contrattuali e commerciali, hanno lead time più lungo di qualsiasi sviluppo, e sono quelle che tipicamente vengono rimandate finché non diventano urgenti.
