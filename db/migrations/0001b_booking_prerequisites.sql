-- Clean-install v1.1 prerequisites reconstructed from the booking contract.
-- This is NOT a recovered copy of the original production v1.1 migration.
-- Apply only to a new database after 0001 + 0001a; existing v1.2 projects skip this.
BEGIN;
SET LOCAL search_path = pg_catalog, public, extensions;
-- Campi del catalogo già presenti nel demo e non inclusi nella v1 minimale.
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS short_name text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS category_color text,
  ADD COLUMN IF NOT EXISTS is_bookable_online boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_quick_choice boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS posa_minutes integer,
  ADD COLUMN IF NOT EXISTS has_variants boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sanificazione boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS display_order integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'services_posa_minutes_nonnegative'
      AND conrelid = 'public.services'::regclass
  ) THEN
    ALTER TABLE public.services
      ADD CONSTRAINT services_posa_minutes_nonnegative
      CHECK (posa_minutes IS NULL OR posa_minutes >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'services_display_order_positive'
      AND conrelid = 'public.services'::regclass
  ) THEN
    ALTER TABLE public.services
      ADD CONSTRAINT services_display_order_positive
      CHECK (display_order IS NULL OR display_order > 0);
  END IF;
END;
$$;

-- La sigla non è unica globalmente nel demo: "TF" compare in Taglio
-- e in Trattamenti. La rendiamo unica solo dentro la categoria.
CREATE UNIQUE INDEX IF NOT EXISTS services_category_short_name_uidx
  ON public.services (category, short_name)
  WHERE category IS NOT NULL AND short_name IS NOT NULL;


ALTER TABLE public.operators
  ADD COLUMN is_bookable_online boolean NOT NULL DEFAULT false,
  ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.bookings
  ADD COLUMN hold_expires_at timestamptz,
  ADD COLUMN service_name_snapshot text,
  ADD COLUMN price_snapshot numeric(10,2),
  ADD COLUMN idempotency_key text,
  ADD COLUMN idempotency_request jsonb,
  ADD CONSTRAINT bookings_hold_expiry CHECK (
    (status='hold' AND hold_expires_at IS NOT NULL AND isfinite(hold_expires_at)) OR
    (status<>'hold' AND hold_expires_at IS NULL));
CREATE UNIQUE INDEX bookings_idempotency_idx ON public.bookings(source,idempotency_key)
  WHERE idempotency_key IS NOT NULL;
ALTER TABLE public.bookings DROP CONSTRAINT bookings_no_operator_overlap;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_no_operator_overlap
  EXCLUDE USING gist(operator_id WITH =,tstzrange(start_at,end_at,'[)') WITH &&)
  WHERE(status IN('hold','confirmed','completed','no_show'));
CREATE INDEX bookings_hold_expiry_idx ON public.bookings(hold_expires_at) WHERE status='hold';

CREATE FUNCTION public.tb_lock_calendar() RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'TB_ISOLATION: READ COMMITTED required';
  END IF;
  PERFORM pg_advisory_xact_lock(742801,1);
END; $$;
CREATE FUNCTION public.tb_expire_holds() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n integer;
BEGIN
  PERFORM public.tb_lock_calendar();
  UPDATE public.bookings SET status='expired',hold_expires_at=NULL
    WHERE status='hold' AND hold_expires_at<=clock_timestamp();
  GET DIAGNOSTICS n=ROW_COUNT;
  RETURN n;
END; $$;
CREATE FUNCTION public.tb_within_working_hours(p_operator_id uuid,p_start_at timestamptz,p_end_at timestamptz)
RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT COALESCE(range_agg(tstzrange(
    ((p_start_at AT TIME ZONE 'Europe/Rome')::date+w.start_time) AT TIME ZONE 'Europe/Rome',
    ((p_start_at AT TIME ZONE 'Europe/Rome')::date+w.end_time) AT TIME ZONE 'Europe/Rome','[)'))
    @> tstzrange(p_start_at,p_end_at,'[)'),false)
  FROM public.working_hours w
  WHERE w.operator_id=p_operator_id AND w.active
    AND w.day_of_week=extract(isodow FROM p_start_at AT TIME ZONE 'Europe/Rome')::integer;
$$;
CREATE FUNCTION public.tb_validate_booking() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE s public.services%ROWTYPE; op public.operators%ROWTYPE;
BEGIN
  PERFORM public.tb_lock_calendar();
  IF NEW.start_at IS NULL OR NEW.end_at IS NULL OR NOT isfinite(NEW.start_at)
     OR NOT isfinite(NEW.end_at) OR NEW.end_at<=NEW.start_at THEN
    RAISE EXCEPTION 'TB_INVALID_INTERVAL';
  END IF;
  SELECT * INTO s FROM public.services WHERE id=NEW.service_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'TB_SERVICE_NOT_FOUND'; END IF;
  IF TG_OP='INSERT' THEN
    NEW.service_name_snapshot:=s.name; NEW.price_snapshot:=s.price;
  ELSE
    IF NEW.service_id IS DISTINCT FROM OLD.service_id THEN RAISE EXCEPTION 'TB_INVALID_REQUEST: service immutable'; END IF;
    NEW.service_name_snapshot:=OLD.service_name_snapshot; NEW.price_snapshot:=OLD.price_snapshot;
    IF OLD.status='hold' AND NEW.status='confirmed' AND OLD.hold_expires_at<=clock_timestamp() THEN
      RAISE EXCEPTION 'TB_HOLD_EXPIRED';
    END IF;
  END IF;
  IF NEW.status='hold' THEN
    IF NEW.hold_expires_at IS NULL OR NOT isfinite(NEW.hold_expires_at)
       OR NEW.hold_expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'TB_HOLD_EXPIRED'; END IF;
  ELSE NEW.hold_expires_at:=NULL;
  END IF;
  IF NEW.status NOT IN('hold','confirmed') THEN RETURN NEW; END IF;
  SELECT * INTO op FROM public.operators WHERE id=NEW.operator_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'TB_OPERATOR_NOT_FOUND'; END IF;
  IF NOT op.active THEN RAISE EXCEPTION 'TB_OPERATOR_UNAVAILABLE'; END IF;
  IF NOT s.active THEN RAISE EXCEPTION 'TB_SERVICE_INACTIVE'; END IF;
  IF NEW.source IN('ai_phone','whatsapp','ghl') THEN
    IF NOT op.is_bookable_online THEN RAISE EXCEPTION 'TB_OPERATOR_MANUAL_ONLY'; END IF;
    IF NOT s.is_bookable_online THEN RAISE EXCEPTION 'TB_SERVICE_MANUAL_ONLY'; END IF;
  END IF;
  IF NOT public.tb_within_working_hours(NEW.operator_id,NEW.start_at,NEW.end_at) THEN
    RAISE EXCEPTION 'TB_OUTSIDE_WORKING_HOURS';
  END IF;
  IF EXISTS(SELECT 1 FROM public.blocked_periods p WHERE p.operator_id=NEW.operator_id
    AND p.start_at<NEW.end_at AND p.end_at>NEW.start_at) THEN RAISE EXCEPTION 'TB_BLOCKED_PERIOD'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER tb_booking_validation BEFORE INSERT OR UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.tb_validate_booking();

-- Serialize configuration writes with booking transactions before acquiring row locks.
CREATE FUNCTION public.tb_calendar_write_lock() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN PERFORM public.tb_lock_calendar(); RETURN NULL; END; $$;
CREATE TRIGGER tb_hours_lock BEFORE INSERT OR UPDATE OR DELETE ON public.working_hours
FOR EACH STATEMENT EXECUTE FUNCTION public.tb_calendar_write_lock();
CREATE TRIGGER tb_blocks_lock BEFORE INSERT OR UPDATE OR DELETE ON public.blocked_periods
FOR EACH STATEMENT EXECUTE FUNCTION public.tb_calendar_write_lock();
CREATE TRIGGER tb_operators_lock BEFORE INSERT OR UPDATE OR DELETE ON public.operators
FOR EACH STATEMENT EXECUTE FUNCTION public.tb_calendar_write_lock();
CREATE TRIGGER tb_services_lock BEFORE INSERT OR UPDATE OR DELETE ON public.services
FOR EACH STATEMENT EXECUTE FUNCTION public.tb_calendar_write_lock();
CREATE FUNCTION public.tb_create_booking(
  p_customer_id uuid,
  p_operator_id uuid,
  p_service_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_source public.booking_source,
  p_idempotency_key text,
  p_hold boolean DEFAULT false,
  p_notes text DEFAULT NULL,
  p_external_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET timezone = 'UTC'
AS $$
DECLARE
  v_request jsonb;
  v_booking public.bookings%ROWTYPE;
  v_duration integer;
  v_end_at timestamptz;
BEGIN
  PERFORM public.tb_lock_calendar();
  PERFORM public.tb_expire_holds();

  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'TB_IDEMPOTENCY_REQUIRED: chiave richiesta';
  END IF;
  IF p_source IS NULL OR p_hold IS NULL THEN
    RAISE EXCEPTION 'TB_INVALID_REQUEST: source e hold obbligatori';
  END IF;

  -- La fine è derivata, non fa parte dell'intenzione del chiamante.
  v_request := jsonb_build_object(
    'customer_id', p_customer_id,
    'operator_id', p_operator_id,
    'service_id', p_service_id,
    'start_at', p_start_at,
    'end_at', p_end_at,
    'source', p_source,
    'hold', p_hold,
    'notes', p_notes,
    'external_id', p_external_id
  );

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE source = p_source AND idempotency_key = p_idempotency_key;

  IF FOUND THEN
    -- Compatibile anche con richieste registrate dalla v1.1.
    -- Un cambio successivo del listino non altera il risultato del retry.
    IF v_booking.idempotency_request IS DISTINCT FROM v_request THEN
      RAISE EXCEPTION
        'TB_IDEMPOTENCY_MISMATCH: chiave riutilizzata con dati diversi';
    END IF;
    RETURN to_jsonb(v_booking);
  END IF;

  IF p_start_at IS NULL
     OR NOT isfinite(p_start_at)
     OR p_start_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'TB_START_INVALID: inizio futuro e finito richiesto';
  END IF;

  IF p_end_at IS NULL OR NOT isfinite(p_end_at) OR p_end_at <= p_start_at THEN
    RAISE EXCEPTION 'TB_INVALID_INTERVAL';
  END IF;
  v_end_at := p_end_at;

  INSERT INTO public.bookings (
    customer_id, operator_id, service_id, start_at, end_at,
    status, hold_expires_at, source, notes, external_id,
    idempotency_key, idempotency_request
  ) VALUES (
    p_customer_id, p_operator_id, p_service_id, p_start_at, v_end_at,
    CASE WHEN p_hold THEN 'hold'::public.booking_status
         ELSE 'confirmed'::public.booking_status END,
    CASE WHEN p_hold THEN clock_timestamp() + interval '7 minutes'
         ELSE NULL END,
    p_source, p_notes, p_external_id, p_idempotency_key,
    v_request || jsonb_build_object('end_at', v_end_at)
  ) RETURNING * INTO v_booking;

  -- Il trigger v1.1 controlla orari/assenze/attivi e acquisisce gli snapshot.
  -- EXCLUDE verifica l'intero intervallo calcolato.
  RETURN to_jsonb(v_booking);
END;
$$;

CREATE OR REPLACE FUNCTION public.tb_change_booking(
  p_booking_id uuid,
  p_action text,
  p_start_at timestamptz DEFAULT NULL,
  p_end_at timestamptz DEFAULT NULL,
  p_operator_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_end_at timestamptz;
BEGIN
  PERFORM public.tb_lock_calendar();
  PERFORM public.tb_expire_holds();

  SELECT * INTO v_booking FROM public.bookings
  WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TB_BOOKING_NOT_FOUND: prenotazione inesistente';
  END IF;

  CASE p_action
    WHEN 'confirm' THEN
      IF v_booking.status IN ('confirmed', 'expired') THEN
        -- Il chiamante deve verificare status: expired NON è confermato.
        RETURN to_jsonb(v_booking);
      END IF;
      IF v_booking.status <> 'hold' THEN
        RAISE EXCEPTION 'TB_INVALID_STATE: solo un hold può essere confermato';
      END IF;
      UPDATE public.bookings
      SET status = 'confirmed', hold_expires_at = NULL
      WHERE id = p_booking_id RETURNING * INTO v_booking;

    WHEN 'cancel' THEN
      IF v_booking.status IN ('cancelled', 'expired') THEN
        RETURN to_jsonb(v_booking);
      END IF;
      IF v_booking.status NOT IN ('hold', 'confirmed') THEN
        RAISE EXCEPTION 'TB_INVALID_STATE: appuntamento già concluso';
      END IF;
      UPDATE public.bookings
      SET status = 'cancelled', hold_expires_at = NULL
      WHERE id = p_booking_id RETURNING * INTO v_booking;

    WHEN 'reschedule' THEN
      IF v_booking.status <> 'confirmed' THEN
        RAISE EXCEPTION 'TB_INVALID_STATE: spostamento solo se confermato';
      END IF;
      IF p_start_at IS NULL OR NOT isfinite(p_start_at)
         OR p_start_at <= clock_timestamp() THEN
        RAISE EXCEPTION 'TB_START_INVALID: nuovo inizio futuro e finito richiesto';
      END IF;

      -- Spostamento normale: conserva la durata ATTUALE del booking,
      -- incluse eventuali modifiche manuali precedenti.
      -- Modifica esplicita: p_end_at fornito dal backend autorizzato.
      v_end_at := COALESCE(
        p_end_at,
        p_start_at + (v_booking.end_at - v_booking.start_at)
      );
      IF NOT isfinite(v_end_at) OR v_end_at <= p_start_at THEN
        RAISE EXCEPTION 'TB_INVALID_INTERVAL: fine non valida';
      END IF;

      UPDATE public.bookings
      SET start_at = p_start_at,
          end_at = v_end_at,
          operator_id = COALESCE(p_operator_id, operator_id)
      WHERE id = p_booking_id RETURNING * INTO v_booking;

    WHEN 'complete', 'no_show' THEN
      IF (p_action = 'complete' AND v_booking.status = 'completed')
         OR (p_action = 'no_show' AND v_booking.status = 'no_show') THEN
        RETURN to_jsonb(v_booking);
      END IF;
      IF v_booking.status <> 'confirmed'
         OR v_booking.start_at > clock_timestamp() THEN
        RAISE EXCEPTION 'TB_INVALID_STATE: appuntamento non iniziato o non confermato';
      END IF;
      UPDATE public.bookings
      SET status = CASE WHEN p_action = 'complete'
        THEN 'completed'::public.booking_status
        ELSE 'no_show'::public.booking_status END
      WHERE id = p_booking_id RETURNING * INTO v_booking;

    ELSE
      RAISE EXCEPTION 'TB_INVALID_ACTION: azione non riconosciuta';
  END CASE;

  RETURN to_jsonb(v_booking);
END;
$$;


REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.bookings FROM service_role;
DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname LIKE 'tb_%'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.signature);
  END LOOP;
END; $$;
COMMIT;
