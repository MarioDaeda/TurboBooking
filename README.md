# TurboBooking — documento di design tecnico

Gestionale per saloni di bellezza e barbieri, sostitutivo di Treatwell Pro, progettato per essere **aperto e integrabile**: Google Calendar, WhatsApp, Instagram/Messenger, GoHighLevel e il receptionist telefonico AI **BetterCallQ**.

Questo repository contiene, per ora, **solo il design**. Nessun codice applicativo.

## Indice

| Documento | Contenuto |
|---|---|
| [01 — Architettura e stack](docs/01-architettura-e-stack.md) | Vincoli, scelte tecnologiche motivate, multi-tenancy, RBAC, ruolo di GoHighLevel |
| [02 — Booking engine](docs/02-booking-engine.md) | Servizi a segmenti, algoritmo a maschere di bit, non-overbooking, macchina a stati |
| [03 — Modello dati](docs/03-modello-dati.md) | Decisioni strutturali, segmentazione CRM, reportistica, migrazione da Treatwell |
| [`db/schema.sql`](db/schema.sql) | DDL completo PostgreSQL |
| [04 — Integrazioni](docs/04-integrazioni.md) | Matrice di proprietà del dato, GoHighLevel, Google Calendar, Meta, BetterCallQ, hardware fiscale |
| [05 — API](docs/05-api.md) | Contratto REST per modulo, autenticazione, rate limiting, realtime |
| [06 — Roadmap](docs/06-roadmap.md) | Fasi 0→4, criteri di uscita, cosa resta fuori |
| [07 — Rischi e compliance](docs/07-rischi-e-compliance.md) | RT, SDI, GDPR art. 9, trasferimento extra-UE, PCI-DSS, rischi tecnici |

## Le sette decisioni portanti

1. **Un servizio è una sequenza di segmenti, non una durata.** Processing / posa / finishing / sanificazione, ciascuno con una propria semantica di occupazione di operatore e postazione. Durante la posa l'operatore è libero e prenotabile: è così che un salone raddoppia la capacità produttiva, e un sistema che lo ignora viene abbandonato in una settimana.

2. **Il non-overbooking è garantito da PostgreSQL, non dal codice.** Vincoli `EXCLUDE USING gist` su `appointment_segments`. Vale identicamente per agenda, web, WhatsApp, telefono e query manuali. Il lock Redis previsto inizialmente è declassato a segnale di UX.

3. **La disponibilità si calcola con maschere di bit**, non con query di overlap. È ciò che rende raggiungibile il budget di 250 ms richiesto da BetterCallQ per rispondere mentre un cliente è al telefono.

4. **TurboBooking è system of record, GoHighLevel è system of engagement.** Noi possediamo ciò che ha conseguenze operative o fiscali; GHL ciò che ha conseguenze comunicative o commerciali. GHL non calcola mai disponibilità e non crea mai appuntamenti.

5. **Anti-corruption layer obbligatorio su GHL.** Costruiamo questo prodotto per uscire da una piattaforma chiusa: non ne adottiamo un'altra senza un percorso di uscita documentato e senza che tutti i dati abbiano il loro master da noi.

6. **I dati art. 9 GDPR** (formule, allergie, patologie, foto) vivono in due sole tabelle, cifrate, con audit su ogni lettura, e **non escono mai** verso sistemi esterni. Imposto da una allowlist nel mapper, non da una convenzione.

7. **Ogni saldo è derivato da un libro mastro** — magazzino, punti, abbonamenti. Nessun contatore aggiornato a mano: si può sempre rispondere a "perché mancano tre pezzi?".

## Nota sull'estetica

La replica visiva di Treatwell Pro è un requisito di prodotto, non una preferenza: è il principale strumento di gestione del rischio di adozione (§07, R5). Il design system va estratto dagli screenshot in `foto-treatwellpro/` **prima** di sviluppare le schermate.
