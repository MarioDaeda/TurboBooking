-- TurboBooking v1.2: durata automatica in creazione.
-- Eseguire UNA VOLTA dopo enum + migrazione v1.1, come postgres.
-- Non rieseguire schema iniziale, seed o migrazione v1.1.
-- Il backend deve rimuovere p_end_at da tb_create_booking.
-- tb_change_booking/reschedule: senza p_end_at conserva la durata corrente;
-- con p_end_at cambia esplicitamente durata (autorizzazione staff nel backend).
-- Le funzioni di validazione, lock, scadenza e i trigger v1.1 restano in uso.

BEGIN;

-- Precondizioni: interrompe senza modifiche se la v1.1 non è presente.
DO $$
BEGIN
  IF to_regprocedure('public.tb_create_booking(uuid,uuid,uuid,timestamptz,timestamptz,public.booking_source,text,boolean,text,text)') IS NULL
     OR to_regprocedure('public.tb_change_booking(uuid,text,timestamptz,timestamptz,uuid)') IS NULL
     OR to_regprocedure('public.tb_expire_holds()') IS NULL
     OR to_regprocedure('public.tb_lock_calendar()') IS NULL THEN
    RAISE EXCEPTION 'TB_MIGRATION_REQUIRED: manca la v1.1 oppure v1.2 già applicata';
  END IF;
END;
$$;

-- Rimuove la vecchia firma: nessun overload pubblico che permetta
-- di scegliere arbitrariamente la fine di una nuova prenotazione.
DROP FUNCTION public.tb_create_booking(
  uuid, uuid, uuid, timestamptz, timestamptz,
  public.booking_source, text, boolean, text, text
);

CREATE FUNCTION public.tb_create_booking(
  p_customer_id uuid,
  p_operator_id uuid,
  p_service_id uuid,
  p_start_at timestamptz,
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
    IF (v_booking.idempotency_request - 'end_at') IS DISTINCT FROM v_request THEN
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

  SELECT duration_minutes INTO v_duration
  FROM public.services
  WHERE id = p_service_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TB_SERVICE_NOT_FOUND: servizio inesistente';
  END IF;
  IF v_duration IS NULL OR v_duration <= 0 THEN
    RAISE EXCEPTION 'TB_DURATION_INVALID: durata del servizio non valida';
  END IF;

  v_end_at := p_start_at + make_interval(mins => v_duration);

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

REVOKE ALL ON FUNCTION public.tb_create_booking(
  uuid,uuid,uuid,timestamptz,public.booking_source,text,boolean,text,text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tb_create_booking(
  uuid,uuid,uuid,timestamptz,public.booking_source,text,boolean,text,text
) TO service_role;

REVOKE ALL ON FUNCTION public.tb_change_booking(
  uuid,text,timestamptz,timestamptz,uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tb_change_booking(
  uuid,text,timestamptz,timestamptz,uuid
) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;

/* TEST FACOLTATIVO: copiare solo da BEGIN a ROLLBACK in una nuova query.
BEGIN;
DO $$
DECLARE
  op uuid; srv uuid; cust uuid;
  t timestamptz;
  b jsonb; retry jsonb; second_booking jsonb; booking_id uuid;
BEGIN
  INSERT INTO public.operators(name) VALUES ('TEST durata') RETURNING id INTO op;
  INSERT INTO public.services(name,duration_minutes,price)
    VALUES ('TEST taglio',45,30) RETURNING id INTO srv;
  INSERT INTO public.customers(first_name) VALUES ('TEST durata') RETURNING id INTO cust;
  t := (((clock_timestamp() AT TIME ZONE 'Europe/Rome')::date + 1)
        + time '10:00') AT TIME ZONE 'Europe/Rome';
  INSERT INTO public.working_hours(operator_id,day_of_week,start_time,end_time)
    VALUES (op,extract(isodow FROM t AT TIME ZONE 'Europe/Rome')::integer,'09:00','19:00');

  b := public.tb_create_booking(cust,op,srv,t,'manual','test-durata-1');
  booking_id := (b->>'id')::uuid;
  IF (b->>'end_at')::timestamptz - (b->>'start_at')::timestamptz <> interval '45 minutes' THEN
    RAISE EXCEPTION 'TEST FALLITO: durata iniziale';
  END IF;

  UPDATE public.services SET duration_minutes=60,price=35 WHERE id=srv;
  retry := public.tb_create_booking(cust,op,srv,t,'manual','test-durata-1');
  IF retry IS DISTINCT FROM b THEN
    RAISE EXCEPTION 'TEST FALLITO: retry dopo cambio listino';
  END IF;
  b := public.tb_change_booking(booking_id,'reschedule',t+interval '1 hour');
  IF (b->>'end_at')::timestamptz - (b->>'start_at')::timestamptz <> interval '45 minutes' THEN
    RAISE EXCEPTION 'TEST FALLITO: durata spostamento';
  END IF;

  -- Estensione manuale a 75 minuti, prezzo storico invariato.
  b := public.tb_change_booking(booking_id,'reschedule',t+interval '1 hour',t+interval '135 minutes');
  IF (b->>'price_snapshot')::numeric <> 30 THEN
    RAISE EXCEPTION 'TEST FALLITO: prezzo storico';
  END IF;
  b := public.tb_change_booking(booking_id,'reschedule',t+interval '3 hours');
  IF (b->>'end_at')::timestamptz - (b->>'start_at')::timestamptz <> interval '75 minutes' THEN
    RAISE EXCEPTION 'TEST FALLITO: durata manuale non conservata';
  END IF;

  second_booking := public.tb_create_booking(cust,op,srv,t+interval '5 hours','manual','test-durata-2');
  IF (second_booking->>'end_at')::timestamptz - (second_booking->>'start_at')::timestamptz <> interval '60 minutes' THEN
    RAISE EXCEPTION 'TEST FALLITO: nuova durata listino';
  END IF;
  BEGIN
    PERFORM public.tb_change_booking(booking_id,'reschedule',t+interval '5 hours');
    RAISE EXCEPTION 'TEST FALLITO: conflitto accettato';
  EXCEPTION WHEN exclusion_violation THEN
    NULL;
  END;
  IF (SELECT start_at FROM public.bookings WHERE id=booking_id) <> t+interval '3 hours' THEN
    RAISE EXCEPTION 'TEST FALLITO: spostamento fallito ha modificato il booking';
  END IF;
  RAISE NOTICE 'OK: durata automatica, retry, spostamento, modifica manuale, prezzo e conflitti';
END;
$$;
ROLLBACK;
*/
