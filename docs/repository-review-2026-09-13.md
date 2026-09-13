# Verifica repository — 13 settembre 2026

Baseline: main `19956eb`. Fonte di contesto: ultimi messaggi della conversazione
“Verifica scopo repo”; le affermazioni sul database remoto non sono state
trattate come un export dello schema. Il controllo GitHub e `git fetch` hanno
confermato la baseline. Nessun database remoto o account reale modificato.

## Correzioni implementate

- `0010_supabase_remote_sync.sql`: allinea le modifiche strutturali descritte
  nella chat, revoca i grant eccessivi, attiva RLS, limita le RPC integrazione
  ai privilegi del chiamante e indicizza le tre foreign key. Gli oggetti
  esistenti devono corrispondere alle migrazioni fino a `0009`.
- Eliminato BetterCallQ dai tipi runtime dei provider; le migrazioni storiche
  e i documenti di licenza/proprietà restano invariati.
- La rubrica trasmette e visualizza il consenso realmente persistito. Il
  consenso parte disattivato e viene azzerato dopo ogni creazione.
- POST clienti valida i campi opzionali e i consensi senza conversioni implicite.
- Ricerca clienti: il testo non può introdurre operatori PostgREST o wildcard.
- Agenda: il salvataggio di appuntamenti esistenti usa PATCH anziché POST.
  I cambi di cliente/servizio/contatti/note non supportati danno un errore
  esplicito; operatore e durata usano la RPC esistente. Il modal chiude dopo
  il salvataggio riuscito. Nessuna selezione implicita del primo cliente con
  nome/telefono corrispondente; cambiare nome invalida l'identità selezionata.
- Timestamp API: rifiutato anche `24:00`, che JavaScript normalizza al giorno
  successivo invece di rifiutarlo.
- CI: aggiunti branch `codex/**`, token GitHub limitato alla lettura dei contenuti.

## Problemi ancora aperti e ordine di implementazione

1. **Orari e ferie persistenti (P0).** `OrariView` e `page.tsx` usano stato
   React, `AgendaView` override locali. Servono API staff e transazioni SQL
   per working_hours/blocked_periods, override datati e UI collegata. La
   disponibilità e il trigger DB devono leggere le stesse regole; vietare
   aggiornamenti che invalidano appuntamenti già confermati.
2. **Competenze operatore-servizio (P0).** Manca la relazione e il relativo
   controllo sia nel calcolo disponibilità sia nella creazione SQL.
   L'assegnazione reale richiede la conferma del salone, non dati inventati.
3. **Gestione catalogo, staff e clienti (P0).** API servizi/operatori sono
   prevalentemente GET; clienti GET/POST. Mancano gestione completa,
   modifica consensi esistenti e storico. Il limite iniziale di 50 clienti
   richiede paginazione e ricerca remota anche nel selettore prenotazioni
   prima dell'import del catalogo clienti reale.
4. **Ciclo appuntamento (P0).** Le RPC/API supportano complete/no_show,
   ma la UI deve offrire azioni persistenti e la modifica di note/servizio.
   Durata personalizzata in creazione non è ancora inviata alla RPC;
   attualmente la durata iniziale è quella del servizio.
5. **Superfici dimostrative (P1).** Cassa, statistiche, magazzino e altre
   schermate contengono mock/stato locale. Non sono funzioni operative.
   Il vecchio agente Claude usa uno store in memoria: non è il percorso
   webhook corrente, ma andrebbe rimosso o isolato come demo.
6. **Collaudo esterno (prima del rilascio).** Applicare/verificare `0010`,
   confrontare migration history e schema remoto, verificare Auth/PostgREST
   su staging, Cron, concorrenza booking e flussi reali Meta/GHL quando
   saranno collegati. La pagina pubblica prenotazioni resta da costruire.

La repo non è ancora un gestionale completo pronto al rilascio. I test con
dipendenze simulate e PGlite coprono le regressioni di codice/SQL; non
sostituiscono E2E browser e test concorrenti su Supabase.

Riferimenti verificati: [RLS e grant Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security),
[funzioni e privilegi](https://supabase.com/docs/guides/database/functions).
