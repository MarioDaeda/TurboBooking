**Turbo Booking × WhatsApp**

*Architettura, costi e roadmap dell\'integrazione WhatsApp Business
Platform con orchestrazione AI propria*

Documento tecnico interno --- cliente: Gianluca Parrucchieri, Forlì ---
settembre 2026

1\. Architettura

Il sistema funziona con noi come orchestratori: WhatsApp non parla mai
direttamente con il modello AI. Ogni messaggio passa attraverso il
nostro backend, che smista tra Meta (trasporto messaggi) e il provider
AI (comprensione e generazione della risposta).

1.1 Flusso end-to-end

- Il cliente scrive al numero WhatsApp del salone (numero attuale di
  Gianluca, da migrare)

- Meta consegna il messaggio al nostro backend via webhook (HTTPS POST)

- Il backend costruisce il prompt (messaggio + storico conversazione +
  contesto prenotazioni) e chiama il modello AI

- Il modello decide se rispondere in linguaggio naturale o chiamare una
  funzione (es. crea_evento, controlla_disponibilità,
  modifica_prenotazione)

- Se chiama una funzione, il backend esegue la chiamata reale verso
  l\'API di Turbo Booking (crea/modifica l\'evento sul calendario)

- Il backend invia la risposta del modello al cliente via API WhatsApp
  (Cloud API)

- Per i riappuntamenti proattivi: un job schedulato interroga Turbo
  Booking, individua chi va ricontattato, e invia un template utility
  pre-approvato --- non passa dal modello AI in questo verso

1.2 Componenti da configurare/creare

  ------------------------- --------------------------------- -----------------
  **Componente**            **Cosa fa**                       **Costo**

  Meta Business Manager +   Account ufficiale per             Gratuito
  WhatsApp Business Account l\'invio/ricezione via API.       (creazione
  (WABA)                    Necessario migrare qui il numero  account)
                            attuale del salone.               

  Numero di telefono        Il numero WhatsApp del salone     Gratuito
  verificato                collegato al WABA. Una volta      
                            migrato, non è più utilizzabile   
                            dall\'app WhatsApp Business       
                            normale in parallelo.             

  Backend orchestratore     Server che riceve i webhook Meta, Costo di sviluppo
  (webhook + API client)    chiama il modello AI, chiama      interno (no
                            l\'API Turbo Booking, richiama    canone esterno)
                            l\'API WhatsApp per la risposta.  
                            Da costruire noi.                 

  Message template          Testi pre-approvati da Meta per i Gratuito il
  (WhatsApp)                messaggi proattivi                processo di
                            (riappuntamento, conferma fuori   approvazione; a
                            finestra). Servono più varianti   pagamento
                            approvate.                        l\'invio (vedi
                                                              sez. 2)

  Integrazione modello AI   Chiamate API per comprendere il   A consumo, vedi
  (Gemini)                  messaggio ed estrarre             sez. 2
                            l\'intento/i parametri di         
                            prenotazione.                     

  Endpoint Turbo Booking    API interna già in sviluppo su    Nessun costo
  per creazione/modifica    Turbo Booking, esposta al backend aggiuntivo (già
  eventi                    orchestratore per                 in roadmap)
                            creare/leggere/modificare         
                            prenotazioni.                     

  Metodo di pagamento su    Obbligatorio entro il 30          N/A (requisito
  Meta Business Suite       settembre 2026 per non bloccare   amministrativo)
                            la consegna dei service message   
                            dal 1° ottobre.                   
  ------------------------- --------------------------------- -----------------

1.3 Perché questa architettura e non alternative

- La WhatsApp Business App (quella gratuita da smartphone) non espone
  API: qualunque automazione su di essa passa per librerie non
  ufficiali, viola i Terms of Service Meta, rischio concreto di ban del
  numero.

- Il modello AI non è vincolato da Meta: possiamo usare Gemini, Claude,
  GPT o altro. L\'unico vincolo Meta riguarda il trasporto dei messaggi,
  non l\'intelligenza che li elabora.

- Restando \"noi\" l\'orchestratore (e non usando Meta Business Agent,
  il servizio AI nativo di Meta), rientriamo sempre nella categoria di
  fatturazione \"service\", più economica della categoria \"Meta
  Business Agent\" (fatturata a token da Meta stessa, mediamente più
  cara nel loro stesso confronto ufficiale).

2\. Ora vs 1° ottobre 2026

Il cambiamento non riguarda la struttura tecnica, ma cosa Meta fattura.
Dal 1° ottobre diventa a pagamento anche il traffico che oggi è gratuito
dentro la finestra di conversazione (24 ore dall\'ultimo messaggio del
cliente).

2.1 Confronto per caso d\'uso

  -------------------- ------------------------- -------------------------
  **Caso d\'uso**      **Ora (fino al            **Dal 1° ottobre 2026**
                       30/09/2026)**             

  Cliente scrive, bot  Gratuito, illimitato      Gratuito fino a 1.000
  risponde (dentro                               messaggi/mese per numero,
  finestra 24h)                                  poi a pagamento a tariffa
                                                 \"service\" (= tariffa
                                                 utility Italia)

  Conferma             Gratuito                  A pagamento, stessa
  prenotazione via                               tariffa
  template utility                               
  (dentro finestra)                              

  Riappuntamento       A pagamento (tariffa      A pagamento, invariato
  proattivo (fuori     utility)                  
  finestra, tu scrivi                            
  per primo)                                     

  Messaggio            A pagamento, tariffa più  A pagamento, invariato
  promozionale         alta                      (tariffa Italia aumentata
  (marketing)                                    dal 1° luglio 2026)

  Approvazione         Solo su template fuori    Invariato --- il flusso
  richiesta per il     finestra (riappuntamenti, reattivo bot↔cliente non
  messaggio            promo)                    ha mai richiesto
                                                 approvazione, né oggi né
                                                 dopo
  -------------------- ------------------------- -------------------------

2.2 Esempio numerico ufficiale Meta

Una conversazione con 1 template marketing + 2 risposte AI + 1 passaggio
a operatore umano + 1 conferma utility, tutta entro un\'ora:

- Oggi: 2 addebiti (solo il marketing e l\'eventuale template fuori
  finestra)

- Dal 1° ottobre: 5 addebiti (marketing + le 2 risposte AI + la risposta
  operatore + l\'utility, tutti fatturati separatamente)

2.3 Cosa NON cambia

- La finestra di servizio resta di 24 ore dall\'ultimo messaggio del
  cliente

- I template restano l\'unico modo per scrivere per primi fuori dalla
  finestra, e restano soggetti ad approvazione Meta

- L\'architettura tecnica (webhook → orchestratore → modello AI → API
  Turbo Booking → risposta) resta identica: cambia solo cosa viene
  fatturato, non come funziona il sistema

3\. Stima di costo: confronto modelli Gemini

*Ipotesi di volume dichiarata (da validare con dati reali di Gianluca
appena disponibili): 300 conversazioni di prenotazione al mese, media 3
scambi cliente + 3 risposte bot a conversazione (900 risposte bot/mese),
circa 150 token di input e 80 di output per risposta (include storico
conversazione, system prompt, schema delle funzioni). Più 100
riappuntamenti proattivi al mese via template utility.*

3.1 Costo del modello AI (a consumo, pagato al provider AI, separato da
Meta)

  ------------------ ------------------ -------------- ------------------
  **Modello**        **Prezzo           **Costo        **Note**
                     (input/output per  stimato/mese   
                     1M token)**        (900           
                                        risposte)**    

  Gemini 3.5         \$0,30 / \$2,50    \~€0,22/mese   Function calling
  Flash-Lite                                           supportato
                                                       esplicitamente,
                                                       ottimizzato per
                                                       high-volume
                                                       agentic workflows
                                                       --- scelta
                                                       consigliata

  Gemini 3.8 Flash   \$0,75 / \$3,75    \~€0,37/mese   Il Flash più
                     (fino al                          intelligente di
                     31/12/2026)                       Google, per agenti
                                                       autonomi e
                                                       workflow
                                                       complessi;
                                                       fallback se
                                                       Flash-Lite mostra
                                                       errori sulle
                                                       chiamate a
                                                       funzione in test
                                                       reali
  ------------------ ------------------ -------------- ------------------

*A questi volumi la differenza di costo tra i due modelli è di pochi
centesimi al mese --- irrilevante rispetto al rischio di un evento
creato male sul calendario per una risposta del modello meno affidabile.
Il costo del modello AI, a questi volumi, resta comunque trascurabile
rispetto al costo dei messaggi WhatsApp.*

3.2 Costo dei messaggi WhatsApp (pagato a Meta, indipendente dal modello
scelto)

  ---------------------------- --------------------- ---------------------
  **Voce**                     **Ora**               **Dal 1° ottobre
                                                     2026**

  900 risposte bot/mese        €0                    Sotto le 1.000/mese →
  (service, dentro finestra)                         ancora €0. Se il
                                                     volume cresce oltre
                                                     1.000, le eccedenti a
                                                     tariffa utility
                                                     Italia (stimata 2-4
                                                     centesimi cad.)

  100 riappuntamenti           \~€2-4/mese (tariffa  Invariato,
  proattivi/mese (utility,     utility Italia)       \~€2-4/mese
  fuori finestra)                                    

  Totale stimato               \~€2-4/mese           \~€2-4/mese (finché
                                                     sotto soglia 1.000
                                                     service/mese)
  ---------------------------- --------------------- ---------------------

*Nota sulla cifra esatta: la tariffa precisa in euro per l\'Italia
(utility/service) non è stata verificata a decimale esatto --- i rate
card ufficiali Meta sono scaricabili solo da un selettore interattivo
(business.whatsapp.com/products/platform-pricing) non indicizzato dai
motori di ricerca. La cifra va confermata scaricando il CSV ufficiale
EUR/Italia prima di comunicare un costo definitivo a Gianluca.*

3.3 Tier Free vs Paid (Google AI)

*L\'API Gemini offre due tier di accesso, indipendenti dalla scelta del
modello. La differenza non è solo di prezzo.*

  -------------------- ------------------------- -------------------------
                       **Free**                  **Paid**

  Costo                Gratuito                  A consumo, tariffe di
                                                 sezione 3.1

  Dati della           Sì                        No
  conversazione usati                            
  da Google per                                  
  addestrare i propri                            
  modelli                                        

  Limiti di traffico   \~10-15 richieste/minuto, Limiti molto più alti,
  (Flash-Lite)         \~1.000-1.500/giorno      adatti a produzione

  Adatto a             Sviluppo e test con dati  Qualsiasi traffico con
                       non reali, sotto il       dati di clienti reali
                       nostro controllo          
  -------------------- ------------------------- -------------------------

*Per lo sviluppo: il tier Free è utilizzabile senza problemi finché i
test usano dati sintetici (nomi, numeri, richieste inventate) creati e
controllati da noi --- sia i limiti di traffico sia il trattamento dati
sono adeguati a questa fase. Per la produzione: appena nel sistema
circolano dati di clienti reali del salone (anche solo per un test più
realistico prima della consegna), va usato il tier Paid --- non è una
questione di volume ma di trattamento dati: i clienti di Gianluca non
hanno dato consenso a che le loro richieste finiscano nel training di
Google. Il passaggio a Paid richiede solo di collegare un metodo di
pagamento su Google AI Studio; è immediato e non blocca nulla del lavoro
già fatto.*

3.4 Casi d\'uso e costo per tipologia (Gemini 3.5 Flash-Lite)

*Non tutte le conversazioni pesano uguale. Di seguito il costo stimato
dei tre pattern di richiesta più comuni per un salone, con Gemini 3.5
Flash-Lite.*

  -------------------- ----------------- ----------------- ---------------
  **Caso d\'uso**      **Scambi tipici** **Costo per       **Note**
                                         conversazione     
                                         (modello AI)**    

  Info semplice        1-2 messaggi,     \~€0,0004         Il più
  (orari, indirizzo,   nessuna chiamata                    economico;
  servizi offerti)     a funzione                          nessun accesso
                                                           a Turbo Booking

  Richiesta            4-6 messaggi,     \~€0,0014         Il caso
  prenotazione         chiamata a                          centrale del
  completa             crea_evento                         prodotto;
                                                           richiede la
                                                           chiamata a
                                                           funzione più
                                                           delicata

  Domanda con foto     2-3 messaggi, 1   \~€0,0012         L\'immagine
  (es. riferimento     immagine in input                   WhatsApp tipica
  taglio)                                                  pesa \~250-500
                                                           token in
                                                           ingresso ---
                                                           l\'input
                                                           multimodale è
                                                           supportato
                                                           nativamente da
                                                           Flash-Lite,
                                                           nessun costo
                                                           aggiuntivo di
                                                           modello diverso
  -------------------- ----------------- ----------------- ---------------

*Anche nel caso più costoso (prenotazione completa), il costo del
modello AI resta sotto mezzo centesimo a conversazione. Il costo
dominante del sistema è e resta quello dei messaggi WhatsApp (sezione
3.2), non il modello AI.*

3.5 Proiezioni di volume

*Solo Gianluca (scenario attuale): stimando 300 conversazioni/mese con
mix tipico tra i tre casi d\'uso, il totale di risposte bot resta sotto
le 1.000/mese --- quindi sotto la soglia gratuita anche dal 1° ottobre
2026, salvo forte crescita imprevista.*

  -------------------- ---------------------- ----------------- -----------------
  **Scenario**         **Conversazioni/mese   **Risposte        **Sotto soglia
                       stimate**              bot/mese          1.000 gratuite
                                              stimate**         (dal 1/10)?**

  Solo Gianluca        \~300                  \~700-900         Sì, con margine

  2-3 saloni (stesso   \~700-900              \~1.800-2.500     No --- parte del
  backend)                                                      traffico a
                                                                pagamento a
                                                                tariffa
                                                                service/utility
                                                                Italia

  Prodotto scalato     3.000+                 8.000+            No --- la soglia
  (10+ saloni)                                                  di 1.000/mese è
                                                                per numero di
                                                                telefono, quindi
                                                                ogni salone ha la
                                                                propria
                                                                franchigia; il
                                                                conteggio va
                                                                fatto per singolo
                                                                numero, non
                                                                aggregato
  -------------------- ---------------------- ----------------- -----------------

*Punto architetturale per lo scenario multi-salone: la soglia gratuita
di 1.000 service message/mese si applica per numero di telefono (WABA),
non a livello di portfolio. Questo significa che il costo cresce
linearmente con il numero di saloni, ma ciascuno mantiene la propria
franchigia --- un vantaggio strutturale se il prodotto scala a più
clienti, perché non serve superare artificialmente la soglia di uno per
restare sotto quella di un altro.*

3.6 Raccomandazione

Gemini 3.5 Flash-Lite. Dichiara supporto esplicito al function calling,
ottimizzato proprio per workflow agentic ad alto volume --- il profilo
di Turbo Booking --- a un prezzo che rimane trascurabile anche nel caso
d\'uso più costoso (prenotazione completa). Va validato con test reali
sulle chiamate a crea_evento prima del lancio in produzione; se emergono
errori di interpretazione su casi ambigui (orari, nomi, servizi) o
sull\'interpretazione delle foto inviate dai clienti, il passaggio a
Gemini 3.8 Flash è immediato e a basso rischio, visto che la differenza
di costo resta marginale --- è il modello Flash più capace attualmente
offerto da Google, pensato per agenti autonomi e workflow complessi.

4\. Prossime task

*Ordine di lavoro: prima il percorso tecnico di programmazione (backend,
poi disegno della conversazione, poi validazione), che può partire
subito su un numero di test. In parallelo, indipendentemente dal codice,
il percorso amministrativo (setup account, verifiche economiche,
template) che serve comunque prima del go-live ma non blocca lo
sviluppo.*

4.1 Percorso tecnico (sequenziale)

4.1.1 Backend orchestratore

- Endpoint webhook per ricevere i messaggi in ingresso da Meta

- Client per l\'API Gemini (3.5 Flash-Lite) con function-calling
  configurato sulle funzioni Turbo Booking (crea_evento,
  controlla_disponibilità, modifica_prenotazione, cancella_prenotazione)

- Gestione input multimodale (foto inviate dal cliente, es. richieste di
  taglio) oltre al testo

- Client per l\'invio messaggi via WhatsApp Cloud API

- Logica di conteggio dei service message per numero di telefono, per
  monitorare l\'avvicinamento alla soglia gratuita di 1.000/mese
  (lettura del campo pricing_category nei webhook di stato Meta)

4.1.2 Disegno della conversazione

- Minimizzare i round-trip per prenotazione nel prompt/flow design, per
  restare il più possibile sotto la soglia gratuita di 1.000 service
  message/mese dopo il 1° ottobre

- Progettare i tre flussi tipo separatamente (info semplice,
  prenotazione, richiesta con foto) --- vedi sezione 3.4 --- così il
  prompt resta mirato e non gonfia inutilmente il contesto per le
  richieste più semplici

- Definire i casi di escalation a operatore umano (Gianluca) per
  richieste che il bot non deve gestire in autonomia

4.1.3 Validazione modello

- Testare Gemini 3.5 Flash-Lite su un set di messaggi reali/simulati per
  ciascuno dei tre casi d\'uso (orari ambigui, nomi storpiati, richieste
  multiple in un messaggio, foto di riferimento) per verificare
  l\'affidabilità del function-calling prima del lancio

- Se il tasso di errore sulle chiamate a crea_evento è troppo alto,
  passare a Gemini 3.8 Flash --- cambio a basso attrito, differenza di
  costo marginale

4.1.4 Test su numero non di produzione

- I primi test tecnici (backend, function-calling, flussi
  conversazionali) partono su un numero WhatsApp diverso da quello di
  Gianluca --- un numero già aziendale disponibile, oppure un numero di
  test dedicato registrato sul WABA di sviluppo

- La WhatsApp Cloud API supporta nativamente numeri di test: Meta mette
  a disposizione un numero di test gratuito legato all\'App developer,
  utilizzabile per le prime chiamate API senza registrare un numero
  reale --- utile per validare l\'integrazione tecnica prima ancora di
  avere un numero business dedicato

- Il numero di Gianluca entra in gioco solo nell\'ultima fase:
  migrazione dal WhatsApp Business App al WABA e collegamento al backend
  già validato (vedi 4.3)

4.2 Percorso amministrativo (parallelo, indipendente dal codice)

4.2.1 Setup account e infrastruttura

- Creare/verificare il Business Manager Meta e il WhatsApp Business
  Account (WABA) di sviluppo

- Registrare un metodo di pagamento su Meta Business Suite (obbligatorio
  entro il 30/09/2026)

- Passare l\'account Google AI da Free a Paid prima della consegna a
  Gianluca --- obbligatorio nel momento in cui il sistema tratta dati di
  clienti reali del salone, non solo dati di test sintetici (vedi
  sezione 3.3)

- Pianificare la finestra di migrazione del numero attuale del salone
  dal WhatsApp Business App al WABA --- comunicare a Gianluca che
  durante/dopo la migrazione non potrà più rispondere manualmente da app
  senza passare dall\'interfaccia del backend

4.2.2 Verifiche economiche

- Scaricare il rate card ufficiale Meta in EUR per l\'Italia (utility,
  marketing, authentication, service) per avere le cifre esatte, non
  stimate

- Ottenere da Gianluca un dato reale sul volume mensile di prenotazioni
  per sostituire l\'ipotesi di lavoro (300/mese) con un numero
  verificato

- Ricalcolare la proiezione di costo dal 1° ottobre una volta note le
  tariffe service definitive (Meta le pubblica entro inizio settembre
  2026 secondo il proprio calendario)

4.2.3 Template WhatsApp

- Scrivere e sottoporre ad approvazione Meta i template utility
  necessari: conferma prenotazione, promemoria/riappuntamento, eventuale
  cancellazione

- Verificare la categorizzazione assegnata da Meta a ciascun template
  (utility vs marketing) prima dell\'uso in produzione

4.3 Go-live

- Una volta validati backend e conversazione sul numero di test, migrare
  il numero reale di Gianluca sul WABA di produzione

- Collegare il numero migrato al backend già testato e avviare in
  produzione
