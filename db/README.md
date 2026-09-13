# Database TurboBooking

`db/migrations/` è la sequenza eseguibile per un database Supabase **nuovo**.
`db/schema.sql` è il vecchio documento di design multi-tenant: non è lo snapshot
operativo e non va eseguito. Il backend dei booking usa `customers`, `operators`,
`services`, `working_hours`, `blocked_periods`, `bookings` e `staff_memberships`.

## Provenienza e ordine

| File | Contenuto e provenienza |
| --- | --- |
| `0001_initial_schema.sql` | Copia integrale di `turbobooking_v1.sql` originale |
| `0001a_hold_enum.sql` | Aggiunta `hold` / `expired`, con commit prima del loro utilizzo |
| `0001b_booking_prerequisites.sql` | Prerequisiti v1.1 ricostruiti per installazioni nuove: catalogo, hold, idempotenza, lock, trigger, RPC e privilegi |
| `0002_turbobooking_v1_2_durate.sql` | Copia integrale della v1.2 validata, incluso test facoltativo commentato |
| `0003_staff_memberships.sql` | Associazione esplicita `auth.users.id` → operatore attivo; lettura server-only |
| `0004_integrations.sql` | Tabelle server-only per webhook idempotenti, riferimenti provider e notifiche |

Il testo originale completo della v1.1 non era disponibile: `0001b` è una nuova
implementazione dei prerequisiti, **non un export del database remoto**.
La sequenza è verificata dai test PostgreSQL incorporati (PGlite). L'identità
esatta con tutti i trigger/configurazioni del progetto remoto richiede un export
dello schema e una verifica di staging prima del merge/deploy.

## Database nuovo

Usare un progetto Supabase vuoto (ruoli `anon`, `authenticated`, `service_role`
e schema `auth` già presenti). Eseguire come amministratore nell'ordine della
tabella; l'aggiunta degli enum deve terminare prima della migrazione successiva.
Con `psql`, da root della repository e con `DATABASE_URL` impostata:

```bash
for migration in db/migrations/*.sql; do
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f "$migration" || exit 1
done
# Solo se si desiderano i dati del salone del demo:
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f db/seeds/01_seed_initial_data.sql
```

Il seed è la copia di `turbobooking_seed_reali.sql`: 40 servizi, Gianluca e Sara,
turni di Gianluca 09:00–19:00 martedì–sabato. Gli operatori nuovi restano
prenotabili manualmente; l'abilitazione online deve essere esplicita.
Le tabelle operative delle integrazioni sono aggiunte in modo incrementale da
`0004_integrations.sql`; il vecchio schema multi-tenant resta solo un documento.

Questa repository usa script `db/migrations`, non contiene un progetto Supabase
CLI inizializzato: `supabase db push/reset` da soli non applicano questi file.

## Progetto esistente già alla v1.2 validata

**Non rieseguire `0001`, `0001a`, `0001b`, `0002` o il seed.**
Applicare `0003_staff_memberships.sql` e `0004_integrations.sql` una volta; quindi:

1. Creare o individuare l'utente staff in Supabase Authentication.
2. Come amministratore, inserire il suo UUID reale e l'UUID dell'operatore:

```sql
INSERT INTO public.staff_memberships (user_id, operator_id)
VALUES ('<UUID_UTENTE_AUTH>', '<UUID_OPERATORE>');
```

3. Configurare `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_ANON_KEY`
   sul server; quest'ultima è la chiave pubblica/anon di progetto per il login.
4. Accedere alla dashboard con email/password. Il cookie HttpOnly contiene il
   JWT personale, scade con esso e non contiene il secret di sistema. Alla scadenza
   occorre accedere di nuovo; non viene conservato un refresh token.
5. Ruotare `INTERNAL_API_SECRET` / `DASHBOARD_STAFF_SECRET` se l'endpoint precedente
   era raggiungibile: la sua rimozione non revoca le credenziali già divulgate.
   Il nuovo accesso M2M richiede Bearer e `x-operator-id` esplicito.

Se il database usa la precedente `0002` errata di questo branch anziché la v1.2
validata, non applicare alla cieca questa sequenza: i tipi e le firme RPC sono
diversi. Serve una migrazione incrementale basata sullo schema effettivo.

## Contratto API e verifiche

- API staff protette; nessun accesso implicito per utenti Supabase generici.
- `GET availability`: `serviceId` UUID obbligatorio, `date` ISO reale opzionale,
  operatore UUID opzionale, granularità intera 5–120 minuti.
- `POST bookings`: `idempotencyKey` non vuota obbligatoria, riutilizzata sui retry;
  `source='dashboard'` assegnato sul server; nessun `p_end_at` in creazione.
- `PATCH bookings/:id`: spostamento senza `endAt` conserva la durata corrente;
  `endAt` esplicito modifica la durata. Confermare un hold scaduto dà 409.
- Errori: 400 input, 401 identità assente/non valida, 403 staff non abilitato,
  404 risorsa assente, 409 conflitto/stato/idempotenza, 500 errore infrastrutturale.

```bash
cd frontend
npm ci
npm test
npm run typecheck
npm run build
```

I test non usano credenziali remote e non toccano il salone. Verificano handler
reali con dipendenze simulate e una ricostruzione PostgreSQL locale tramite
PGlite. Non sostituiscono un test end-to-end contro Supabase Auth/PostgREST né
un test concorrente con più connessioni PostgreSQL.
