-- TurboBooking v1: un salone, un servizio e un operatore per booking.
-- Eseguire una sola volta nel Supabase SQL Editor, come postgres.
-- Non elimina ne' sostituisce tabelle esistenti.

BEGIN;

-- 1. SCHEMA / DATABASE
-- gen_random_uuid() e' nativa in PostgreSQL >= 13: niente pgcrypto.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;
SET LOCAL search_path = pg_catalog, public, extensions;

CREATE TYPE public.booking_status AS ENUM (
  'confirmed', 'cancelled', 'completed', 'no_show'
);
CREATE TYPE public.booking_source AS ENUM (
  'dashboard', 'ai_phone', 'whatsapp', 'ghl', 'manual'
);

CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text,
  phone text,
  email text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.operators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  duration_minutes integer NOT NULL,
  price numeric(10,2) NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT services_duration_positive CHECK (duration_minutes > 0),
  CONSTRAINT services_price_nonnegative
    CHECK (price >= 0 AND price <> 'NaN'::numeric)
);

CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id)
    ON DELETE RESTRICT,
  operator_id uuid NOT NULL REFERENCES public.operators(id)
    ON DELETE RESTRICT,
  service_id uuid NOT NULL REFERENCES public.services(id)
    ON DELETE RESTRICT,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  status public.booking_status NOT NULL DEFAULT 'confirmed',
  notes text,
  source public.booking_source NOT NULL DEFAULT 'manual',
  external_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bookings_valid_interval CHECK (
    end_at > start_at AND isfinite(start_at) AND isfinite(end_at)
  ),
  -- [inizio, fine): consente appuntamenti consecutivi.
  -- Completed e no_show mantengono occupato l'intervallo storico.
  CONSTRAINT bookings_no_operator_overlap
    EXCLUDE USING gist (
      operator_id WITH =,
      tstzrange(start_at, end_at, '[)') WITH &&
    ) WHERE (status <> 'cancelled'::public.booking_status)
);

CREATE TABLE public.working_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.operators(id)
    ON DELETE RESTRICT,
  day_of_week integer NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT working_hours_valid_day CHECK (day_of_week BETWEEN 1 AND 7),
  CONSTRAINT working_hours_valid_interval CHECK (end_time > start_time)
);

COMMENT ON COLUMN public.working_hours.day_of_week IS
  'ISO: 1=lunedi, 2=martedi, ..., 7=domenica';
COMMENT ON COLUMN public.working_hours.start_time IS
  'Ora locale del salone: Europe/Rome nella v1';

CREATE TABLE public.blocked_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.operators(id)
    ON DELETE RESTRICT,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blocked_periods_valid_interval CHECK (
    end_at > start_at AND isfinite(start_at) AND isfinite(end_at)
  )
);

-- Indice per ricerca esatta del telefono, senza obbligo di unicita'.
CREATE INDEX customers_phone_idx ON public.customers (phone)
  WHERE phone IS NOT NULL;

-- Il vincolo EXCLUDE crea gia' un indice GiST operatore/intervallo.
-- B-tree complementari per calendario ordinato, storico e foreign key.
CREATE INDEX bookings_operator_start_idx
  ON public.bookings (operator_id, start_at);
CREATE INDEX bookings_start_idx ON public.bookings (start_at);
CREATE INDEX bookings_customer_start_idx
  ON public.bookings (customer_id, start_at DESC);
CREATE INDEX bookings_service_idx ON public.bookings (service_id);
CREATE INDEX bookings_source_external_idx
  ON public.bookings (source, external_id) WHERE external_id IS NOT NULL;

CREATE INDEX working_hours_operator_day_idx
  ON public.working_hours (operator_id, day_of_week, start_time);
CREATE INDEX blocked_periods_operator_interval_idx
  ON public.blocked_periods USING gist (
    operator_id, tstzrange(start_at, end_at, '[)')
  );

CREATE FUNCTION public.turbobooking_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER customers_set_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.turbobooking_set_updated_at();

CREATE TRIGGER operators_set_updated_at
BEFORE UPDATE ON public.operators
FOR EACH ROW EXECUTE FUNCTION public.turbobooking_set_updated_at();

CREATE TRIGGER services_set_updated_at
BEFORE UPDATE ON public.services
FOR EACH ROW EXECUTE FUNCTION public.turbobooking_set_updated_at();

CREATE TRIGGER bookings_set_updated_at
BEFORE UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.turbobooking_set_updated_at();

CREATE TRIGGER working_hours_set_updated_at
BEFORE UPDATE ON public.working_hours
FOR EACH ROW EXECUTE FUNCTION public.turbobooking_set_updated_at();

CREATE TRIGGER blocked_periods_set_updated_at
BEFORE UPDATE ON public.blocked_periods
FOR EACH ROW EXECUTE FUNCTION public.turbobooking_set_updated_at();

-- 2. SICUREZZA / RLS: nessuna policy per il frontend nella v1.
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.working_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_periods ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE
  public.customers, public.operators, public.services,
  public.bookings, public.working_hours, public.blocked_periods
FROM PUBLIC, anon, authenticated;

-- Privilegi espliciti anche se il progetto ha default differenti.
REVOKE ALL PRIVILEGES ON TABLE
  public.customers, public.operators, public.services,
  public.bookings, public.working_hours, public.blocked_periods
FROM service_role;

GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.customers, public.operators, public.services,
  public.bookings, public.working_hours, public.blocked_periods
TO service_role;

REVOKE ALL PRIVILEGES ON TYPE
  public.booking_status, public.booking_source
FROM PUBLIC, anon, authenticated;
GRANT USAGE ON TYPE
  public.booking_status, public.booking_source
TO service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.turbobooking_set_updated_at()
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.turbobooking_set_updated_at()
TO service_role;

-- 3. POLICY FUTURE: deliberatamente assenti.
-- Prima di aprire l'accesso frontend: membership staff legata ad auth.users,
-- ruoli e policy per operazione; poi GRANT dei soli privilegi necessari.
-- Non basta consentire l'accesso a qualsiasi utente autenticato.

COMMIT;

/*
TEST SQL FACOLTATIVI
Copiare da BEGIN a ROLLBACK in una nuova query DOPO aver creato lo schema.
Il blocco seguente e' commentato: non viene eseguito con la migrazione.
Gli UUID vengono generati automaticamente; ROLLBACK rimuove i dati di test.

BEGIN;
SET LOCAL TIME ZONE 'Europe/Rome';

DO $$
DECLARE
  v_operator uuid;
  v_service uuid;
  v_customer uuid;
  v_first_booking uuid;
  v_second_booking uuid;
BEGIN
  -- 1. Operatore.
  INSERT INTO public.operators (name)
  VALUES ('TEST - Operatore') RETURNING id INTO v_operator;

  -- 2. Servizio.
  INSERT INTO public.services (name, duration_minutes, price)
  VALUES ('TEST - Taglio uomo', 30, 25.00) RETURNING id INTO v_service;

  -- 3. Cliente: telefono ed email NULL sono ammessi.
  INSERT INTO public.customers (first_name, last_name, phone, email)
  VALUES ('Mario', 'Test', NULL, NULL) RETURNING id INTO v_customer;

  -- Martedi: orario locale del salone, senza slot pre-generati.
  INSERT INTO public.working_hours
    (operator_id, day_of_week, start_time, end_time)
  VALUES (v_operator, 2, '08:00', '19:00');

  -- 4. Prenotazione iniziale: 10:00-10:30.
  INSERT INTO public.bookings
    (customer_id, operator_id, service_id, start_at, end_at, source)
  VALUES (
    v_customer, v_operator, v_service,
    '2026-09-15 10:00:00+02', '2026-09-15 10:30:00+02', 'dashboard'
  ) RETURNING id INTO v_first_booking;

  -- 5. Sovrapposizione: deve produrre SQLSTATE 23P01.
  -- Il sottoblocco intercetta SOLO l'errore atteso e permette di continuare.
  BEGIN
    INSERT INTO public.bookings
      (customer_id, operator_id, service_id, start_at, end_at, source)
    VALUES (
      v_customer, v_operator, v_service,
      '2026-09-15 10:15:00+02', '2026-09-15 10:45:00+02', 'ai_phone'
    );
    RAISE EXCEPTION 'TEST FALLITO: sovrapposizione accettata';
  EXCEPTION WHEN exclusion_violation THEN
    RAISE NOTICE 'OK: sovrapposizione rifiutata (23P01)';
  END;

  -- 6. Cancellazione logica: lo storico resta, l'intervallo si libera.
  UPDATE public.bookings SET status = 'cancelled'
  WHERE id = v_first_booking;

  INSERT INTO public.bookings
    (customer_id, operator_id, service_id, start_at, end_at, source)
  VALUES (
    v_customer, v_operator, v_service,
    '2026-09-15 10:00:00+02', '2026-09-15 10:30:00+02', 'whatsapp'
  ) RETURNING id INTO v_second_booking;
  RAISE NOTICE 'OK: intervallo nuovamente prenotabile, nuovo booking %',
    v_second_booking;

  -- 7. Confine condiviso consentito: 10:30-11:00.
  INSERT INTO public.bookings
    (customer_id, operator_id, service_id, start_at, end_at)
  VALUES (
    v_customer, v_operator, v_service,
    '2026-09-15 10:30:00+02', '2026-09-15 11:00:00+02'
  );
  RAISE NOTICE 'OK: appuntamento consecutivo accettato';

  -- 8. Anche riattivare una prenotazione deve rispettare il vincolo.
  BEGIN
    UPDATE public.bookings SET status = 'confirmed'
    WHERE id = v_first_booking;
    RAISE EXCEPTION 'TEST FALLITO: riattivazione sovrapposta accettata';
  EXCEPTION WHEN exclusion_violation THEN
    RAISE NOTICE 'OK: riattivazione sovrapposta rifiutata';
  END;

  -- 9. Protezione storico: il cliente con prenotazioni non si elimina.
  BEGIN
    DELETE FROM public.customers WHERE id = v_customer;
    RAISE EXCEPTION 'TEST FALLITO: cliente con storico eliminato';
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE NOTICE 'OK: eliminazione cliente con storico rifiutata';
  END;

  RAISE NOTICE 'TUTTI I TEST SUPERATI';
END;
$$;

ROLLBACK;
*/
