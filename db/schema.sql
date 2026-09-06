-- =============================================================================
-- TurboBooking — schema PostgreSQL 16
-- Documento di design: non è una migrazione eseguibile in produzione così com'è
-- (mancano indici di tuning fine, partizionamento e seed). È il contratto dati.
--
-- Convenzioni
--   * importi        : BIGINT in centesimi ("_cents"). Mai float, mai numeric in JS.
--   * tempi          : TIMESTAMPTZ (UTC). L'ora locale si deriva da venues.timezone.
--   * intervalli     : TSTZRANGE con indice GiST.
--   * tenant         : organization_id NOT NULL su ogni tabella + RLS.
--   * id esterni     : mai colonne dedicate — vedi external_refs.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;    -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- EXCLUDE con uuid + range
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- ricerca fuzzy in Rubrica
CREATE EXTENSION IF NOT EXISTS citext;      -- email case-insensitive

-- =============================================================================
-- 1. TENANCY, UTENTI, AUTORIZZAZIONI
-- =============================================================================

CREATE TABLE organizations (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    legal_name          text        NOT NULL,
    trade_name          text        NOT NULL,
    vat_number          text,                       -- P.IVA
    tax_code            text,                       -- Codice fiscale
    sdi_recipient_code  text,                       -- Codice destinatario SDI
    pec_email           citext,
    country             char(2)     NOT NULL DEFAULT 'IT',
    default_locale      text        NOT NULL DEFAULT 'it-IT',
    default_currency    char(3)     NOT NULL DEFAULT 'EUR',
    plan                text        NOT NULL DEFAULT 'trial',
    status              text        NOT NULL DEFAULT 'active',
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE venues (
    id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id           uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    name                      text        NOT NULL,
    slug                      text        NOT NULL,          -- URL prenotazione pubblica
    timezone                  text        NOT NULL DEFAULT 'Europe/Rome',
    address_line              text,
    city                      text,
    postal_code               text,
    province                  char(2),
    phone                     text,
    email                     citext,
    slot_granularity_minutes  smallint    NOT NULL DEFAULT 5
        CHECK (slot_granularity_minutes IN (5, 10, 15)),
    salon_type                text,                           -- parrucchiere | estetica | barbiere | misto
    logo_asset_id             uuid,
    is_active                 boolean     NOT NULL DEFAULT true,
    created_at                timestamptz NOT NULL DEFAULT now(),
    updated_at                timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organization_id, slug)
);
CREATE INDEX ON venues (organization_id);

CREATE TYPE user_role AS ENUM ('owner', 'manager', 'receptionist', 'staff');

CREATE TABLE users (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email               citext      NOT NULL,
    password_hash       text,                                  -- Argon2id; NULL se solo SSO
    full_name           text        NOT NULL,
    role                user_role   NOT NULL,
    mfa_secret          text,                                  -- obbligatorio per role='owner'
    last_login_at       timestamptz,
    is_active           boolean     NOT NULL DEFAULT true,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organization_id, email)
);

-- Quali sedi può vedere un utente. Assenza di righe per un owner = tutte le sedi.
CREATE TABLE user_venue_access (
    user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    venue_id    uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, venue_id)
);

CREATE TABLE refresh_tokens (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    family_id       uuid        NOT NULL,                      -- rotazione: riuso ⇒ revoca famiglia
    token_hash      text        NOT NULL,
    expires_at      timestamptz NOT NULL,
    revoked_at      timestamptz,
    user_agent      text,
    ip_address      inet,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON refresh_tokens (user_id, family_id);

-- Client machine-to-machine: BetterCallQ, integrazioni custom.
CREATE TABLE api_clients (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name                text        NOT NULL,
    client_id           text        NOT NULL UNIQUE,
    client_secret_hash  text        NOT NULL,
    scopes              text[]      NOT NULL DEFAULT '{}',
    allowed_venue_ids   uuid[],
    rate_limit_tier     text        NOT NULL DEFAULT 'standard',
    revoked_at          timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now()
);

-- Riferimenti verso sistemi esterni (GoHighLevel, Google, Meta, Stripe...).
-- Nessun id esterno viene mai aggiunto come colonna a una tabella di dominio.
CREATE TABLE external_refs (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    provider            text        NOT NULL,      -- 'ghl' | 'google' | 'stripe' | 'sdi'
    entity_type         text        NOT NULL,      -- 'customer' | 'appointment' | 'venue' | 'staff'
    entity_id           uuid        NOT NULL,
    external_id         text        NOT NULL,
    metadata            jsonb       NOT NULL DEFAULT '{}',
    synced_at           timestamptz,
    sync_state          text        NOT NULL DEFAULT 'ok',  -- ok | pending | error
    sync_error          text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (provider, entity_type, entity_id),
    UNIQUE (provider, entity_type, external_id)
);
CREATE INDEX ON external_refs (organization_id, provider, sync_state);

-- =============================================================================
-- 2. STAFF
-- =============================================================================

CREATE TABLE staff (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id         uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    venue_id                uuid        NOT NULL REFERENCES venues(id) ON DELETE RESTRICT,
    user_id                 uuid        REFERENCES users(id) ON DELETE SET NULL,  -- NULL se non ha login
    display_name            text        NOT NULL,          -- etichetta colonna in Agenda
    initials                text,
    color_hex               char(7),
    first_name              text,
    last_name               text,
    phone                   text,
    email                   citext,
    birth_date              date,
    hired_on                date,
    terminated_on           date,
    commission_percent      numeric(5,2) NOT NULL DEFAULT 0,   -- provvigione su servizi
    retail_commission_percent numeric(5,2) NOT NULL DEFAULT 0, -- provvigione su rivendita
    monthly_cost_cents      bigint,                            -- costo aziendale, per la redditività
    is_bookable             boolean     NOT NULL DEFAULT true,
    show_in_public_booking  boolean     NOT NULL DEFAULT true,
    sort_order              smallint    NOT NULL DEFAULT 0,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON staff (organization_id, venue_id) WHERE terminated_on IS NULL;

-- Turno settimanale ricorrente dell'operatore (≠ orario del salone).
CREATE TABLE staff_schedules (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid     NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    staff_id        uuid     NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    weekday         smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),  -- 0 = lunedì
    starts_at       time     NOT NULL,
    ends_at         time     NOT NULL,
    valid_from      date     NOT NULL DEFAULT CURRENT_DATE,
    valid_until     date,
    CHECK (ends_at > starts_at)
);
CREATE INDEX ON staff_schedules (staff_id, weekday);

CREATE TYPE absence_type AS ENUM ('vacation', 'leave', 'sick', 'training', 'other');

CREATE TABLE staff_absences (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    staff_id        uuid         NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    kind            absence_type NOT NULL DEFAULT 'leave',
    during          tstzrange    NOT NULL,
    note            text,
    created_by      uuid REFERENCES users(id),
    created_at      timestamptz  NOT NULL DEFAULT now(),
    EXCLUDE USING gist (staff_id WITH =, during WITH &&)   -- niente assenze sovrapposte
);
CREATE INDEX ON staff_absences USING gist (during);

-- =============================================================================
-- 3. ORARI DELLA SEDE
-- =============================================================================

CREATE TABLE venue_business_hours (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid     NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    venue_id        uuid     NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    weekday         smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
    starts_at       time     NOT NULL,
    ends_at         time     NOT NULL,
    CHECK (ends_at > starts_at)
);
-- Più righe per giorno = orario spezzato (es. 09:00-13:00 e 15:00-19:30).
CREATE INDEX ON venue_business_hours (venue_id, weekday);

CREATE TYPE hour_exception_type AS ENUM ('extra_opening', 'closure');

-- Copre sia "Aperture straordinarie" sia "Chiusure straordinarie".
CREATE TABLE venue_hour_exceptions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid                NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    venue_id        uuid                NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    kind            hour_exception_type NOT NULL,
    during          tstzrange           NOT NULL,
    reason          text,
    created_by      uuid REFERENCES users(id),
    created_at      timestamptz         NOT NULL DEFAULT now()
);
CREATE INDEX ON venue_hour_exceptions USING gist (during);
CREATE INDEX ON venue_hour_exceptions (venue_id, kind);

-- Regole di policy commerciale: applicate DOPO l'intersezione di disponibilità
-- e solo ai canali pubblici, mai all'agenda interna.
CREATE TABLE booking_rules (
    id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id           uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    venue_id                  uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    min_notice_minutes        int  NOT NULL DEFAULT 120,
    max_horizon_days          int  NOT NULL DEFAULT 90,
    buffer_after_minutes      int  NOT NULL DEFAULT 0,
    cancellation_window_hours int  NOT NULL DEFAULT 24,
    require_approval          boolean NOT NULL DEFAULT false,  -- stato 'pending' invece di 'confirmed'
    deposit_required          boolean NOT NULL DEFAULT false,
    deposit_amount_cents      bigint,
    deposit_percent           numeric(5,2),
    allow_interleaving        boolean NOT NULL DEFAULT true,   -- prenotare l'operatore durante la posa
    applies_to_channels       text[]  NOT NULL DEFAULT '{web,whatsapp,instagram,phone_ai}',
    UNIQUE (venue_id)
);

-- =============================================================================
-- 4. RISORSE FISICHE (Postazioni)
-- =============================================================================

CREATE TABLE resource_types (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            text NOT NULL,      -- 'Poltrona', 'Lavatesta', 'Cabina estetica'
    UNIQUE (organization_id, name)
);

CREATE TABLE resources (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     uuid    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    venue_id            uuid    NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    resource_type_id    uuid    REFERENCES resource_types(id) ON DELETE SET NULL,
    name                text    NOT NULL,          -- 'Postazione 1'
    capacity            smallint NOT NULL DEFAULT 1 CHECK (capacity >= 1),
    is_active           boolean NOT NULL DEFAULT true,
    sort_order          smallint NOT NULL DEFAULT 0,
    created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON resources (organization_id, venue_id) WHERE is_active;

CREATE TABLE resource_downtime (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid      NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    resource_id     uuid      NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    during          tstzrange NOT NULL,
    reason          text
);
CREATE INDEX ON resource_downtime USING gist (during);

-- =============================================================================
-- 5. SERVIZI (Trattamenti) E SEGMENTI
-- =============================================================================

CREATE TABLE service_categories (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            text NOT NULL,
    color_hex       char(7),
    sort_order      smallint NOT NULL DEFAULT 0
);

CREATE TABLE services (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id         uuid    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    venue_id                uuid    REFERENCES venues(id) ON DELETE CASCADE, -- NULL = tutte le sedi
    category_id             uuid    REFERENCES service_categories(id) ON DELETE SET NULL,
    name                    text    NOT NULL,
    short_code              text,                    -- 'CR' = Colore Radice, mostrato in Agenda
    description             text,
    price_cents             bigint  NOT NULL,
    vat_rate                numeric(5,2) NOT NULL DEFAULT 22.00,
    -- Durate: derivate dai segmenti, qui denormalizzate per liste e ricerche.
    total_duration_minutes  int     NOT NULL,
    staff_busy_minutes      int     NOT NULL,        -- somma dei segmenti blocks_staff
    requires_resource_type  uuid    REFERENCES resource_types(id),
    color_hex               char(7),
    is_bookable_online      boolean NOT NULL DEFAULT true,
    allow_interleaving      boolean NOT NULL DEFAULT true,
    cost_cents              bigint  NOT NULL DEFAULT 0,  -- costo prodotti tecnici stimato
    is_active               boolean NOT NULL DEFAULT true,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON services (organization_id, category_id) WHERE is_active;

CREATE TYPE segment_kind AS ENUM ('processing', 'lay', 'finishing', 'sanitation');

-- ⭐ La tabella che rende il motore diverso da un booking generico.
CREATE TABLE service_segments (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     uuid         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    service_id          uuid         NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    ordinal             smallint     NOT NULL,
    kind                segment_kind NOT NULL,
    duration_minutes    int          NOT NULL CHECK (duration_minutes > 0),
    blocks_staff        boolean      NOT NULL,     -- false per 'lay' e 'sanitation'
    blocks_resource     boolean      NOT NULL DEFAULT true,
    required_staff_count smallint    NOT NULL DEFAULT 1,  -- >1 per servizi a quattro mani
    label               text,
    UNIQUE (service_id, ordinal)
);

-- Prezzo e durata custom per operatore.
CREATE TABLE staff_services (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    staff_id            uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    service_id          uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    price_cents         bigint,        -- NULL = eredita da services
    commission_percent  numeric(5,2),  -- NULL = eredita da staff
    is_enabled          boolean NOT NULL DEFAULT true,
    UNIQUE (staff_id, service_id)
);

-- Override della durata del singolo segmento per un dato operatore.
CREATE TABLE staff_service_segment_overrides (
    staff_service_id    uuid NOT NULL REFERENCES staff_services(id) ON DELETE CASCADE,
    service_segment_id  uuid NOT NULL REFERENCES service_segments(id) ON DELETE CASCADE,
    duration_minutes    int  NOT NULL CHECK (duration_minutes > 0),
    PRIMARY KEY (staff_service_id, service_segment_id)
);

-- Pacchetti / abbonamenti ("5 tagli").
CREATE TABLE service_packages (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     uuid   NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name                text   NOT NULL,
    price_cents         bigint NOT NULL,
    validity_days       int,
    is_active           boolean NOT NULL DEFAULT true
);

CREATE TABLE service_package_items (
    package_id  uuid NOT NULL REFERENCES service_packages(id) ON DELETE CASCADE,
    service_id  uuid NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
    quantity    smallint NOT NULL CHECK (quantity > 0),
    PRIMARY KEY (package_id, service_id)
);

-- =============================================================================
-- 6. CLIENTI (Rubrica) E CRM
-- =============================================================================

CREATE TABLE customers (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    primary_venue_id    uuid        REFERENCES venues(id) ON DELETE SET NULL,
    first_name          text,
    last_name           text,
    phone_e164          text,                       -- chiave di deduplica e di lookup telefonico
    email               citext,
    gender              text CHECK (gender IN ('F','M','X')),
    birth_date          date,
    address_line        text,
    city                text,
    postal_code         text,
    tax_code            text,
    preferred_staff_id  uuid        REFERENCES staff(id) ON DELETE SET NULL,
    source              text,                       -- direct | web | whatsapp | instagram | phone_ai | import
    is_blocked          boolean     NOT NULL DEFAULT false,   -- no-show ripetuti
    -- Metriche denormalizzate, aggiornate dal worker CRM (§03).
    first_visit_at      timestamptz,
    last_visit_at       timestamptz,
    visits_count        int         NOT NULL DEFAULT 0,
    lifetime_value_cents bigint     NOT NULL DEFAULT 0,
    avg_ticket_cents    bigint      NOT NULL DEFAULT 0,
    no_show_count       int         NOT NULL DEFAULT 0,
    rfm_segment         text,                       -- champion | loyal | at_risk | lost | new
    deleted_at          timestamptz,                -- soft delete: art. 17 GDPR vs obbligo fiscale
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ON customers (organization_id, phone_e164)
    WHERE phone_e164 IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX ON customers USING gin ((coalesce(first_name,'') || ' ' || coalesce(last_name,'')) gin_trgm_ops);
CREATE INDEX ON customers (organization_id, rfm_segment, last_visit_at);

-- Consensi: base giuridica di ogni trattamento, tracciata singolarmente.
CREATE TABLE customer_consents (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    customer_id     uuid        NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    purpose         text        NOT NULL,   -- privacy | marketing_email | marketing_sms
                                            -- | marketing_whatsapp | profiling | health_data | photos
    granted         boolean     NOT NULL,
    granted_at      timestamptz NOT NULL DEFAULT now(),
    revoked_at      timestamptz,
    proof           jsonb       NOT NULL DEFAULT '{}',  -- canale, IP, testo informativa, versione
    UNIQUE (customer_id, purpose, granted_at)
);
CREATE INDEX ON customer_consents (customer_id, purpose);

-- ⚠️ ART. 9 GDPR — non esce MAI verso GoHighLevel o altri sistemi esterni.
CREATE TABLE customer_notes (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    customer_id     uuid        NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    appointment_id  uuid,                                  -- FK aggiunta dopo appointments
    kind            text        NOT NULL DEFAULT 'note',   -- note | formula | allergy | pathology
    body            text        NOT NULL,
    formula         jsonb,                                 -- miscele colore strutturate
    is_sensitive    boolean     NOT NULL DEFAULT false,    -- true ⇒ cifrato a livello applicativo
    author_user_id  uuid REFERENCES users(id),
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON customer_notes (customer_id, created_at DESC);

-- ⚠️ ART. 9 GDPR — foto prima/dopo. Solo URL firmati a scadenza breve.
CREATE TABLE customer_media (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    customer_id     uuid        NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    appointment_id  uuid,
    storage_key     text        NOT NULL,     -- chiave S3, mai URL pubblico
    mime_type       text        NOT NULL,
    byte_size       bigint      NOT NULL,
    taken_at        date,
    phase           text CHECK (phase IN ('before','after','reference')),
    uploaded_by     uuid REFERENCES users(id),
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON customer_media (customer_id, taken_at DESC);

-- =============================================================================
-- 7. APPUNTAMENTI  ⭐ cuore del sistema
-- =============================================================================

CREATE TYPE appointment_status AS ENUM (
    'hold', 'pending', 'confirmed', 'in_progress', 'completed',
    'cancelled', 'no_show', 'expired'
);

CREATE TYPE booking_channel AS ENUM (
    'direct', 'web', 'whatsapp', 'instagram', 'messenger', 'phone_ai', 'google', 'import'
);

CREATE TABLE appointments (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     uuid               NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    venue_id            uuid               NOT NULL REFERENCES venues(id) ON DELETE RESTRICT,
    customer_id         uuid               REFERENCES customers(id) ON DELETE RESTRICT,
    -- Cliente occasionale non ancora in rubrica (prenotazione rapida in Agenda).
    walk_in_name        text,
    walk_in_phone       text,
    status              appointment_status NOT NULL DEFAULT 'hold',
    channel             booking_channel    NOT NULL DEFAULT 'direct',
    -- Intervallo complessivo: ridondante rispetto ai segmenti, serve per liste e
    -- report senza aggregare. Mantenuto da trigger.
    span                tstzrange          NOT NULL,
    total_price_cents   bigint             NOT NULL DEFAULT 0,
    discount_cents      bigint             NOT NULL DEFAULT 0,
    deposit_cents       bigint             NOT NULL DEFAULT 0,
    deposit_intent_ref  text,                                  -- PaymentIntent Stripe
    hold_expires_at     timestamptz,                           -- valorizzato solo con status='hold'
    internal_note       text,
    cancellation_reason text,
    cancelled_at        timestamptz,
    cancelled_by        uuid REFERENCES users(id),
    created_by_user_id  uuid REFERENCES users(id),
    created_by_client_id uuid REFERENCES api_clients(id),      -- BetterCallQ
    idempotency_key     text,
    created_at          timestamptz        NOT NULL DEFAULT now(),
    updated_at          timestamptz        NOT NULL DEFAULT now(),
    CHECK (customer_id IS NOT NULL OR walk_in_name IS NOT NULL),
    CHECK ((status = 'hold') = (hold_expires_at IS NOT NULL))
);
CREATE UNIQUE INDEX ON appointments (organization_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;
CREATE INDEX ON appointments USING gist (span);
CREATE INDEX ON appointments (venue_id, status, lower(span));
CREATE INDEX ON appointments (customer_id, lower(span) DESC);
CREATE INDEX ON appointments (hold_expires_at) WHERE status = 'hold';

ALTER TABLE customer_notes ADD CONSTRAINT customer_notes_appointment_fk
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL;
ALTER TABLE customer_media ADD CONSTRAINT customer_media_appointment_fk
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL;

-- Righe di servizio dell'appuntamento (un appuntamento = 1..N trattamenti).
CREATE TABLE appointment_services (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     uuid   NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    appointment_id      uuid   NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    service_id          uuid   NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
    staff_id            uuid   REFERENCES staff(id) ON DELETE RESTRICT,
    ordinal             smallint NOT NULL DEFAULT 0,
    price_cents         bigint NOT NULL,
    discount_cents      bigint NOT NULL DEFAULT 0,
    package_token_id    uuid,                       -- consumo di un abbonamento
    service_name_snapshot text NOT NULL,            -- il servizio può essere rinominato dopo
    UNIQUE (appointment_id, ordinal)
);

-- ⭐⭐ La tabella su cui il DB garantisce l'assenza di sovrapposizioni.
CREATE TABLE appointment_segments (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id         uuid         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    venue_id                uuid         NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    appointment_id          uuid         NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    appointment_service_id  uuid         REFERENCES appointment_services(id) ON DELETE CASCADE,
    service_segment_id      uuid         REFERENCES service_segments(id) ON DELETE SET NULL,
    kind                    segment_kind NOT NULL,
    ordinal                 smallint     NOT NULL,
    staff_id                uuid         REFERENCES staff(id) ON DELETE RESTRICT,
    resource_id             uuid         REFERENCES resources(id) ON DELETE RESTRICT,
    during                  tstzrange    NOT NULL,
    blocks_staff            boolean      NOT NULL,
    blocks_resource         boolean      NOT NULL,
    -- Denormalizzato da appointments.status via trigger: un EXCLUDE non può
    -- leggere un'altra tabella.
    is_blocking             boolean      NOT NULL DEFAULT true,

    CONSTRAINT no_staff_overlap EXCLUDE USING gist (
        staff_id WITH =, during WITH &&
    ) WHERE (is_blocking AND blocks_staff AND staff_id IS NOT NULL),

    CONSTRAINT no_resource_overlap EXCLUDE USING gist (
        resource_id WITH =, during WITH &&
    ) WHERE (is_blocking AND blocks_resource AND resource_id IS NOT NULL)
);
CREATE INDEX ON appointment_segments USING gist (during);
CREATE INDEX ON appointment_segments (venue_id, staff_id, during) WHERE is_blocking;
CREATE INDEX ON appointment_segments (appointment_id);

-- NB: per resources.capacity > 1 il vincolo EXCLUDE non basta (ammette 1 solo
-- occupante). Le risorse a capacità multipla vanno modellate come N righe in
-- `resources` con capacity = 1 ("Cabina A / posto 1", "posto 2"): mantiene la
-- garanzia dichiarativa invece di spostarla nel codice applicativo.

CREATE TABLE appointment_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    appointment_id  uuid        NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    from_status     appointment_status,
    to_status       appointment_status NOT NULL,
    channel         booking_channel,
    actor_user_id   uuid REFERENCES users(id),
    actor_client_id uuid REFERENCES api_clients(id),
    payload         jsonb       NOT NULL DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON appointment_events (appointment_id, created_at);

-- Occupazione proveniente da calendari esterni (Google). Sottrae disponibilità,
-- non genera mai appuntamenti.
CREATE TABLE external_busy_blocks (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     uuid      NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    staff_id            uuid      NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    provider            text      NOT NULL DEFAULT 'google',
    external_event_id   text      NOT NULL,
    during              tstzrange NOT NULL,
    title               text,                       -- solo se lo staff acconsente
    synced_at           timestamptz NOT NULL DEFAULT now(),
    UNIQUE (provider, staff_id, external_event_id)
);
CREATE INDEX ON external_busy_blocks USING gist (during);

-- Conflitti che richiedono decisione umana (chiusura straordinaria che taglia
-- appuntamenti, evento Google sovrapposto, doppia modifica).
CREATE TABLE agenda_conflicts (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    venue_id        uuid        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    appointment_id  uuid        REFERENCES appointments(id) ON DELETE CASCADE,
    kind            text        NOT NULL,  -- closure_overlap | external_overlap | sync_divergence
    detail          jsonb       NOT NULL DEFAULT '{}',
    resolved_at     timestamptz,
    resolved_by     uuid REFERENCES users(id),
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON agenda_conflicts (venue_id) WHERE resolved_at IS NULL;

-- =============================================================================
-- 8. CASSA, INCASSI, FISCALITÀ
-- =============================================================================

CREATE TABLE cash_registers (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    venue_id        uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    name            text NOT NULL,
    fiscal_device_serial text,          -- matricola RT
    fiscal_device_url   text,           -- endpoint agent locale / ePOS-Device
    is_active       boolean NOT NULL DEFAULT true
);

CREATE TABLE cash_register_sessions (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    cash_register_id    uuid        NOT NULL REFERENCES cash_registers(id) ON DELETE RESTRICT,
    business_date       date        NOT NULL,
    opened_at           timestamptz NOT NULL DEFAULT now(),
    opened_by           uuid REFERENCES users(id),
    opening_float_cents bigint      NOT NULL DEFAULT 0,
    closed_at           timestamptz,
    closed_by           uuid REFERENCES users(id),
    counted_cash_cents  bigint,
    expected_cash_cents bigint,
    difference_cents    bigint,
    z_report            jsonb,                  -- snapshot Z immutabile
    UNIQUE (cash_register_id, business_date)
);
-- Una sola sessione aperta per cassa.
CREATE UNIQUE INDEX ON cash_register_sessions (cash_register_id) WHERE closed_at IS NULL;

CREATE TYPE receipt_type AS ENUM ('fiscal_receipt', 'invoice', 'credit_note', 'proforma');

CREATE TABLE receipts (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     uuid         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    venue_id            uuid         NOT NULL REFERENCES venues(id) ON DELETE RESTRICT,
    session_id          uuid         REFERENCES cash_register_sessions(id) ON DELETE RESTRICT,
    customer_id         uuid         REFERENCES customers(id) ON DELETE SET NULL,
    appointment_id      uuid         REFERENCES appointments(id) ON DELETE SET NULL,
    kind                receipt_type NOT NULL DEFAULT 'fiscal_receipt',
    number              text         NOT NULL,
    issued_at           timestamptz  NOT NULL DEFAULT now(),
    gross_cents         bigint       NOT NULL,
    net_cents           bigint       NOT NULL,
    vat_cents           bigint       NOT NULL,
    services_cents      bigint       NOT NULL DEFAULT 0,   -- colonne del report Corrispettivi
    retail_cents        bigint       NOT NULL DEFAULT 0,
    promotions_cents    bigint       NOT NULL DEFAULT 0,
    -- Esito del registratore telematico
    fiscal_document_number text,
    fiscal_device_serial   text,
    fiscal_status       text         NOT NULL DEFAULT 'pending', -- pending|sent|failed|voided
    fiscal_error        text,
    voided_by_receipt_id uuid REFERENCES receipts(id),
    created_by          uuid REFERENCES users(id),
    UNIQUE (organization_id, venue_id, kind, number)
);
CREATE INDEX ON receipts (venue_id, issued_at DESC);
CREATE INDEX ON receipts (organization_id, fiscal_status) WHERE fiscal_status <> 'sent';

CREATE TABLE receipt_lines (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     uuid   NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    receipt_id          uuid   NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
    line_type           text   NOT NULL,   -- service | product | package | gift_card | deposit
    service_id          uuid   REFERENCES services(id),
    product_id          uuid,
    staff_id            uuid   REFERENCES staff(id),   -- per provvigioni e Report Collaboratori
    description         text   NOT NULL,
    quantity            numeric(10,3) NOT NULL DEFAULT 1,
    unit_price_cents    bigint NOT NULL,
    discount_cents      bigint NOT NULL DEFAULT 0,
    vat_rate            numeric(5,2) NOT NULL,
    total_cents         bigint NOT NULL
);
CREATE INDEX ON receipt_lines (receipt_id);
CREATE INDEX ON receipt_lines (staff_id);

CREATE TYPE payment_method AS ENUM (
    'cash', 'card', 'bank_transfer', 'gift_card', 'package', 'loyalty_points', 'online', 'other'
);

-- Split payment: N righe per ricevuta.
CREATE TABLE payments (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid           NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    receipt_id      uuid           REFERENCES receipts(id) ON DELETE CASCADE,
    appointment_id  uuid           REFERENCES appointments(id) ON DELETE SET NULL,
    method          payment_method NOT NULL,
    amount_cents    bigint         NOT NULL,
    gift_card_id    uuid,
    psp_reference   text,                   -- Stripe/Adyen
    psp_status      text,
    is_deposit      boolean        NOT NULL DEFAULT false,
    captured_at     timestamptz,
    created_at      timestamptz    NOT NULL DEFAULT now()
);
CREATE INDEX ON payments (receipt_id);

-- Entrate/uscite di cassa non legate a vendite.
CREATE TABLE cash_movements (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    session_id      uuid        NOT NULL REFERENCES cash_register_sessions(id) ON DELETE RESTRICT,
    direction       text        NOT NULL CHECK (direction IN ('in','out')),
    amount_cents    bigint      NOT NULL CHECK (amount_cents > 0),
    reason          text        NOT NULL,
    created_by      uuid REFERENCES users(id),
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- Fatturazione elettronica SDI.
CREATE TABLE einvoices (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    receipt_id          uuid        NOT NULL REFERENCES receipts(id) ON DELETE RESTRICT,
    sdi_transmission_id text,
    xml_storage_key     text        NOT NULL,
    signed_xml_key      text,
    status              text        NOT NULL DEFAULT 'draft',
        -- draft|queued|sent|delivered|rejected|not_delivered|accepted_by_sdi
    sdi_status_history  jsonb       NOT NULL DEFAULT '[]',
    error_code          text,
    sent_at             timestamptz,
    archived_until      date,                    -- conservazione sostitutiva 10 anni
    created_at          timestamptz NOT NULL DEFAULT now()
);

-- Spese operative del salone.
CREATE TABLE expenses (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    venue_id        uuid        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    category        text        NOT NULL,   -- affitto | utenze | personale | prodotti | marketing
    supplier_id     uuid,
    description     text        NOT NULL,
    amount_cents    bigint      NOT NULL,
    vat_cents       bigint      NOT NULL DEFAULT 0,
    expense_date    date        NOT NULL,
    payment_method  payment_method,
    document_key    text,                   -- allegato in S3
    created_by      uuid REFERENCES users(id),
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON expenses (venue_id, expense_date DESC);

-- =============================================================================
-- 9. MAGAZZINO, FORNITORI, PRODUTTORI
-- =============================================================================

-- Produttore (brand) e fornitore (chi vende) sono entità distinte: lo stesso
-- brand può arrivare da più grossisti a condizioni diverse.
CREATE TABLE manufacturers (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            text NOT NULL,
    website         text,
    UNIQUE (organization_id, name)
);

CREATE TABLE suppliers (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            text NOT NULL,
    vat_number      text,
    contact_name    text,
    email           citext,
    phone           text,
    address_line    text,
    payment_terms_days smallint NOT NULL DEFAULT 30,
    notes           text,
    is_active       boolean NOT NULL DEFAULT true,
    UNIQUE (organization_id, name)
);
ALTER TABLE expenses ADD CONSTRAINT expenses_supplier_fk
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;

-- Opzioni di spedizione per gli ordini a fornitore.
CREATE TABLE supplier_shipping_options (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid   NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    supplier_id     uuid   NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    name            text   NOT NULL,
    cost_cents      bigint NOT NULL DEFAULT 0,
    free_over_cents bigint,
    lead_time_days  smallint,
    is_default      boolean NOT NULL DEFAULT false
);

CREATE TABLE products (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     uuid    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    manufacturer_id     uuid    REFERENCES manufacturers(id) ON DELETE SET NULL,
    default_supplier_id uuid    REFERENCES suppliers(id) ON DELETE SET NULL,
    sku                 text,
    barcode             text,
    name                text    NOT NULL,
    line                text,                       -- linea/gamma del brand
    format              text,                       -- '250 ml'
    -- Doppia destinazione: rivendita, uso tecnico interno, o entrambi.
    is_retail           boolean NOT NULL DEFAULT true,
    is_professional     boolean NOT NULL DEFAULT false,
    retail_price_cents  bigint,
    cost_cents          bigint  NOT NULL DEFAULT 0,
    vat_rate            numeric(5,2) NOT NULL DEFAULT 22.00,
    unit                text    NOT NULL DEFAULT 'pz',   -- pz | ml | g
    min_stock           numeric(12,3) NOT NULL DEFAULT 0,
    reorder_quantity    numeric(12,3),
    is_active           boolean NOT NULL DEFAULT true,
    created_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organization_id, sku)
);
CREATE INDEX ON products (organization_id) WHERE is_active;
ALTER TABLE receipt_lines ADD CONSTRAINT receipt_lines_product_fk
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;

-- Giacenza per sede (una riga per prodotto/sede).
CREATE TABLE stock_items (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    venue_id        uuid          NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    product_id      uuid          NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity        numeric(12,3) NOT NULL DEFAULT 0,
    avg_cost_cents  bigint        NOT NULL DEFAULT 0,      -- costo medio ponderato
    last_counted_at timestamptz,
    UNIQUE (venue_id, product_id)
);

CREATE TYPE stock_movement_reason AS ENUM (
    'purchase', 'retail_sale', 'professional_use', 'inventory_adjustment',
    'return_to_supplier', 'waste', 'transfer_in', 'transfer_out', 'initial'
);

-- Libro mastro immutabile del magazzino: stock_items.quantity è derivato.
CREATE TABLE stock_movements (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     uuid                  NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    venue_id            uuid                  NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    product_id          uuid                  NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    reason              stock_movement_reason NOT NULL,
    quantity_delta      numeric(12,3)         NOT NULL,   -- negativo per scarico
    unit_cost_cents     bigint,
    appointment_id      uuid REFERENCES appointments(id) ON DELETE SET NULL,
    receipt_line_id     uuid REFERENCES receipt_lines(id) ON DELETE SET NULL,
    purchase_order_id   uuid,
    lot_number          text,
    expiry_date         date,                              -- Scadenzario
    note                text,
    created_by          uuid REFERENCES users(id),
    created_at          timestamptz           NOT NULL DEFAULT now()
);
CREATE INDEX ON stock_movements (venue_id, product_id, created_at DESC);
CREATE INDEX ON stock_movements (expiry_date) WHERE expiry_date IS NOT NULL;

-- Quanto prodotto tecnico consuma un servizio: alimenta lo scarico automatico
-- e il costo del venduto nel report di redditività.
CREATE TABLE service_product_usage (
    service_id      uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    product_id      uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity        numeric(12,3) NOT NULL,
    PRIMARY KEY (service_id, product_id)
);

CREATE TABLE purchase_orders (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    venue_id            uuid        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    supplier_id         uuid        NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    shipping_option_id  uuid        REFERENCES supplier_shipping_options(id),
    number              text        NOT NULL,
    status              text        NOT NULL DEFAULT 'draft',
        -- draft|sent|partially_received|received|cancelled
    total_cents         bigint      NOT NULL DEFAULT 0,
    sent_at             timestamptz,
    expected_at         date,
    received_at         timestamptz,
    due_date            date,                  -- Scadenzario pagamenti fornitore
    paid_at             timestamptz,
    document_key        text,
    created_by          uuid REFERENCES users(id),
    created_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organization_id, number)
);
CREATE INDEX ON purchase_orders (venue_id, status);
CREATE INDEX ON purchase_orders (due_date) WHERE paid_at IS NULL;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_po_fk
    FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE SET NULL;

CREATE TABLE purchase_order_lines (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     uuid          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    purchase_order_id   uuid          NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id          uuid          NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity_ordered    numeric(12,3) NOT NULL,
    quantity_received   numeric(12,3) NOT NULL DEFAULT 0,
    unit_cost_cents     bigint        NOT NULL
);

-- =============================================================================
-- 10. PROMOZIONI, GIFT CARD, LOYALTY, ABBONAMENTI
-- =============================================================================

CREATE TABLE promotions (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    venue_id            uuid        REFERENCES venues(id) ON DELETE CASCADE,
    name                text        NOT NULL,
    code                text,
    discount_type       text        NOT NULL CHECK (discount_type IN ('percent','amount')),
    discount_value      numeric(10,2) NOT NULL,
    applies_to          text        NOT NULL DEFAULT 'services',  -- services|products|all
    service_ids         uuid[],
    valid_during        tstzrange   NOT NULL,
    valid_weekdays      smallint[],           -- promo solo infrasettimanali
    valid_time_from     time,
    valid_time_to       time,
    max_redemptions     int,
    redemptions_count   int         NOT NULL DEFAULT 0,
    new_customers_only  boolean     NOT NULL DEFAULT false,
    is_active           boolean     NOT NULL DEFAULT true,
    created_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organization_id, code)
);

CREATE TABLE gift_cards (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    code                text        NOT NULL,
    initial_value_cents bigint      NOT NULL,
    balance_cents       bigint      NOT NULL,
    purchased_by_customer_id uuid   REFERENCES customers(id) ON DELETE SET NULL,
    assigned_to_customer_id  uuid   REFERENCES customers(id) ON DELETE SET NULL,
    issued_receipt_id   uuid        REFERENCES receipts(id) ON DELETE SET NULL,
    expires_on          date,
    is_active           boolean     NOT NULL DEFAULT true,
    created_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organization_id, code),
    CHECK (balance_cents >= 0 AND balance_cents <= initial_value_cents)
);
ALTER TABLE payments ADD CONSTRAINT payments_gift_card_fk
    FOREIGN KEY (gift_card_id) REFERENCES gift_cards(id) ON DELETE SET NULL;

CREATE TABLE loyalty_wallets (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     uuid   NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    customer_id         uuid   NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    points_balance      int    NOT NULL DEFAULT 0 CHECK (points_balance >= 0),
    tier                text,
    updated_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organization_id, customer_id)
);

-- Libro mastro punti: il saldo è derivato, mai scritto direttamente.
CREATE TABLE loyalty_transactions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    wallet_id       uuid        NOT NULL REFERENCES loyalty_wallets(id) ON DELETE CASCADE,
    points_delta    int         NOT NULL,
    reason          text        NOT NULL,   -- earn_purchase | redeem | expire | manual
    receipt_id      uuid REFERENCES receipts(id) ON DELETE SET NULL,
    expires_on      date,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON loyalty_transactions (wallet_id, created_at DESC);

-- Abbonamento acquistato dal cliente.
CREATE TABLE customer_packages (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     uuid   NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    customer_id         uuid   NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    package_id          uuid   NOT NULL REFERENCES service_packages(id) ON DELETE RESTRICT,
    purchased_receipt_id uuid  REFERENCES receipts(id) ON DELETE SET NULL,
    purchased_at        timestamptz NOT NULL DEFAULT now(),
    expires_on          date
);

-- Un token = una prestazione residua. Il consumo è un UPDATE su riga singola:
-- niente decrementi di contatori soggetti a race condition.
CREATE TABLE customer_package_tokens (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id         uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    customer_package_id     uuid NOT NULL REFERENCES customer_packages(id) ON DELETE CASCADE,
    service_id              uuid NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
    consumed_at             timestamptz,
    consumed_appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL
);
CREATE INDEX ON customer_package_tokens (customer_package_id) WHERE consumed_at IS NULL;
ALTER TABLE appointment_services ADD CONSTRAINT appointment_services_token_fk
    FOREIGN KEY (package_token_id) REFERENCES customer_package_tokens(id) ON DELETE SET NULL;

-- =============================================================================
-- 11. RECENSIONI
-- =============================================================================

CREATE TABLE reviews (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    venue_id        uuid        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    appointment_id  uuid        REFERENCES appointments(id) ON DELETE SET NULL,
    customer_id     uuid        REFERENCES customers(id) ON DELETE SET NULL,
    staff_id        uuid        REFERENCES staff(id) ON DELETE SET NULL,
    service_id      uuid        REFERENCES services(id) ON DELETE SET NULL,
    rating          smallint    NOT NULL CHECK (rating BETWEEN 1 AND 5),
    body            text,
    source          text        NOT NULL DEFAULT 'internal',  -- internal | google | ghl
    is_published    boolean     NOT NULL DEFAULT true,
    reply_body      text,
    replied_at      timestamptz,
    replied_by      uuid REFERENCES users(id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (appointment_id)     -- una recensione per appuntamento
);
CREATE INDEX ON reviews (venue_id, created_at DESC);
CREATE INDEX ON reviews (staff_id, rating);

-- =============================================================================
-- 12. NOTIFICHE E INTEGRAZIONI
-- =============================================================================

-- Log di ogni messaggio uscito, qualunque sia il canale/provider.
-- Serve per: audit del consenso, diagnostica, e per non dipendere da GHL
-- per sapere cosa è stato mandato a chi.
CREATE TABLE notification_messages (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    customer_id         uuid        REFERENCES customers(id) ON DELETE SET NULL,
    appointment_id      uuid        REFERENCES appointments(id) ON DELETE SET NULL,
    channel             text        NOT NULL,   -- sms | email | whatsapp | instagram | messenger | push
    provider            text        NOT NULL,   -- ghl | direct_meta | ...
    template_key        text,
    to_address          text        NOT NULL,
    body_preview        text,
    status              text        NOT NULL DEFAULT 'queued',
        -- queued|sent|delivered|read|failed|rejected_no_consent
    provider_message_id text,
    error               text,
    consent_checked     boolean     NOT NULL DEFAULT false,
    scheduled_for       timestamptz,
    sent_at             timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON notification_messages (organization_id, status, scheduled_for);
CREATE INDEX ON notification_messages (appointment_id);

-- Transactional outbox: gli eventi si scrivono nella stessa transazione del
-- dominio, un relay li pubblica su BullMQ. Nessun evento perso, mai.
CREATE TABLE outbox_events (
    id              bigserial PRIMARY KEY,
    organization_id uuid        NOT NULL,
    aggregate_type  text        NOT NULL,   -- appointment | customer | receipt | stock
    aggregate_id    uuid        NOT NULL,
    event_type      text        NOT NULL,   -- appointment.confirmed | customer.updated
    payload         jsonb       NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    published_at    timestamptz,
    attempts        smallint    NOT NULL DEFAULT 0,
    last_error      text
);
CREATE INDEX ON outbox_events (published_at, id) WHERE published_at IS NULL;

-- Webhook in ingresso (GHL, Google, Stripe, Meta): persistiti PRIMA di essere
-- processati, per idempotenza e replay.
CREATE TABLE inbound_webhooks (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider        text        NOT NULL,
    external_id     text,                   -- id evento del provider, per dedup
    organization_id uuid,
    signature_valid boolean     NOT NULL,
    payload         jsonb       NOT NULL,
    received_at     timestamptz NOT NULL DEFAULT now(),
    processed_at    timestamptz,
    error           text,
    UNIQUE (provider, external_id)
);
CREATE INDEX ON inbound_webhooks (processed_at) WHERE processed_at IS NULL;

-- Credenziali OAuth per sede (Google Calendar per staff, location GHL).
CREATE TABLE integration_connections (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    venue_id            uuid        REFERENCES venues(id) ON DELETE CASCADE,
    staff_id            uuid        REFERENCES staff(id) ON DELETE CASCADE,
    provider            text        NOT NULL,   -- google_calendar | ghl
    account_label       text,
    access_token_enc    bytea,                  -- cifrato con chiave applicativa (KMS)
    refresh_token_enc   bytea,
    expires_at          timestamptz,
    scopes              text[],
    sync_token          text,                   -- Google incremental sync
    channel_id          text,                   -- Google watch channel
    channel_expires_at  timestamptz,
    status              text        NOT NULL DEFAULT 'active', -- active|expired|revoked|error
    last_sync_at        timestamptz,
    last_error          text,
    created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON integration_connections (provider, status);
CREATE INDEX ON integration_connections (channel_expires_at) WHERE channel_expires_at IS NOT NULL;

-- Traccia di ogni accesso a dati art. 9 e di ogni azione privilegiata.
CREATE TABLE audit_log (
    id              bigserial PRIMARY KEY,
    organization_id uuid        NOT NULL,
    actor_user_id   uuid,
    actor_client_id uuid,
    action          text        NOT NULL,   -- read_sensitive | export | delete | login | grant
    entity_type     text,
    entity_id       uuid,
    ip_address      inet,
    user_agent      text,
    detail          jsonb       NOT NULL DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON audit_log (organization_id, created_at DESC);
CREATE INDEX ON audit_log (entity_type, entity_id);

-- =============================================================================
-- 13. TRIGGER DI COERENZA
-- =============================================================================

-- Mantiene appointment_segments.is_blocking allineato a appointments.status.
CREATE OR REPLACE FUNCTION sync_segment_blocking() RETURNS trigger AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        UPDATE appointment_segments
           SET is_blocking = NEW.status IN
               ('hold','pending','confirmed','in_progress','completed')
         WHERE appointment_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_segment_blocking
    AFTER UPDATE OF status ON appointments
    FOR EACH ROW EXECUTE FUNCTION sync_segment_blocking();

-- Mantiene appointments.span = inviluppo dei segmenti.
CREATE OR REPLACE FUNCTION sync_appointment_span() RETURNS trigger AS $$
DECLARE
    target_id uuid;
    new_span  tstzrange;
BEGIN
    -- NEW non è assegnato su DELETE, OLD non lo è su INSERT: niente COALESCE.
    IF TG_OP = 'DELETE' THEN
        target_id := OLD.appointment_id;
    ELSE
        target_id := NEW.appointment_id;
    END IF;

    SELECT tstzrange(min(lower(s.during)), max(upper(s.during)), '[)')
      INTO new_span
      FROM appointment_segments s
     WHERE s.appointment_id = target_id;

    -- Ultimo segmento rimosso (riprogrammazione in corso): span invariato,
    -- la transazione chiamante inserirà i nuovi segmenti.
    IF new_span IS NOT NULL THEN
        UPDATE appointments a SET span = new_span WHERE a.id = target_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_appointment_span
    AFTER INSERT OR UPDATE OR DELETE ON appointment_segments
    FOR EACH ROW EXECUTE FUNCTION sync_appointment_span();

-- Giacenza derivata dal libro mastro.
CREATE OR REPLACE FUNCTION apply_stock_movement() RETURNS trigger AS $$
BEGIN
    INSERT INTO stock_items (organization_id, venue_id, product_id, quantity)
    VALUES (NEW.organization_id, NEW.venue_id, NEW.product_id, NEW.quantity_delta)
    ON CONFLICT (venue_id, product_id)
    DO UPDATE SET quantity = stock_items.quantity + EXCLUDED.quantity;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_apply_stock_movement
    AFTER INSERT ON stock_movements
    FOR EACH ROW EXECUTE FUNCTION apply_stock_movement();

-- =============================================================================
-- 14. ROW-LEVEL SECURITY
-- =============================================================================

-- Applica RLS a tutte le tabelle che portano organization_id.
DO $$
DECLARE t text;
BEGIN
    FOR t IN
        SELECT c.relname
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          JOIN pg_attribute a ON a.attrelid = c.oid
         WHERE n.nspname = 'public'
           AND c.relkind = 'r'
           AND a.attname = 'organization_id'
           AND NOT a.attisdropped
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
        EXECUTE format($f$
            CREATE POLICY tenant_isolation ON %I
              USING (organization_id = current_setting('app.current_org', true)::uuid)
              WITH CHECK (organization_id = current_setting('app.current_org', true)::uuid)
        $f$, t);
    END LOOP;
END $$;

-- Il ruolo runtime NON deve poter aggirare la RLS.
-- CREATE ROLE turbobooking_app LOGIN NOBYPASSRLS;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO turbobooking_app;
--
-- Ogni transazione applicativa DEVE iniziare con:
--   SET LOCAL app.current_org = '<uuid>';
-- SET LOCAL, non SET: con un connection pool un SET normale sopravvive alla
-- restituzione della connessione e contamina la richiesta successiva.
