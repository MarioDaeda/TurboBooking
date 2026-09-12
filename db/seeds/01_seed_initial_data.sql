-- TurboBooking: dati reali del demo HTML
-- Prerequisito: eseguire prima turbobooking_v1.sql.
-- Eseguibile più volte: usa UUID stabili e ON CONFLICT.

BEGIN;

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

-- Operatori: Gianluca è quello principale. Sara resta attiva, ma senza
-- orario ricorrente: le sue disponibilità si aggiungono quando necessarie.
INSERT INTO public.operators (id, name, active)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'Gianluca Tadonio', true),
  ('10000000-0000-4000-8000-000000000002', 'Sara Tadonio', true)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    active = EXCLUDED.active;

-- Orari ricorrenti del demo: 09:00–19:00, martedì–sabato.
-- ISO day_of_week: 2=martedì ... 6=sabato.
INSERT INTO public.working_hours
  (id, operator_id, day_of_week, start_time, end_time, active)
SELECT
  ('11000000-0000-4000-8000-' || lpad(day::text, 12, '0'))::uuid,
  '10000000-0000-4000-8000-000000000001'::uuid,
  day, '09:00', '19:00', true
FROM generate_series(2, 6) AS day
ON CONFLICT (id) DO UPDATE
SET operator_id = EXCLUDED.operator_id,
    day_of_week = EXCLUDED.day_of_week,
    start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time,
    active = EXCLUDED.active;

-- Catalogo: 40 servizi estratti da RAW_SERVICES del demo.
INSERT INTO public.services (
  id, name, description, duration_minutes, price, active,
  short_name, category, category_color, is_bookable_online,
  is_quick_choice, posa_minutes, has_variants, sanificazione, display_order
)
VALUES
  ('20000000-0000-4000-8000-000000000001', 'Dry Cut Capelli Corti', NULL, 15, 10.00, true, 'DC', 'Taglio', '#1B6478', true, true, NULL, false, false, 1),
  ('20000000-0000-4000-8000-000000000002', 'Taglio e Asciugatura Capelli Lunghi', NULL, 60, 57.00, true, 'TAL', 'Taglio', '#1B6478', true, true, NULL, false, false, 2),
  ('20000000-0000-4000-8000-000000000003', 'Taglio Frangia', NULL, 15, 5.00, true, 'TF', 'Taglio', '#1B6478', true, false, NULL, false, false, 3),
  ('20000000-0000-4000-8000-000000000004', 'Taglio Parziale', NULL, 90, 54.00, true, 'TP', 'Taglio', '#1B6478', true, false, NULL, false, false, 4),
  ('20000000-0000-4000-8000-000000000005', 'Taglio Uomo Top Stylist', NULL, 45, 30.00, true, 'TU', 'Taglio', '#1B6478', true, true, NULL, false, false, 5),
  ('20000000-0000-4000-8000-000000000006', 'Taglio Donna', NULL, 90, 61.00, true, 'TD', 'Taglio', '#1B6478', true, true, NULL, false, false, 6),

  ('20000000-0000-4000-8000-000000000007', 'Piega Capelli Corti', NULL, 60, 36.00, true, 'PC', 'Piega', '#0284C7', true, true, NULL, false, false, 7),
  ('20000000-0000-4000-8000-000000000008', 'Piega Capelli Lunghi', NULL, 75, 36.00, true, 'PL', 'Piega', '#0284C7', true, true, NULL, false, false, 8),
  ('20000000-0000-4000-8000-000000000009', 'PETTINATA', NULL, 15, 15.00, true, 'P', 'Piega', '#0284C7', true, false, NULL, false, false, 9),
  ('20000000-0000-4000-8000-000000000010', 'Asciugatura', NULL, 15, 10.00, true, 'AS', 'Piega', '#0284C7', true, true, NULL, false, false, 10),

  ('20000000-0000-4000-8000-000000000011', 'Servizio Sposo', NULL, 90, 100.00, true, 'SS', 'Acconciatura', '#8B5CF6', true, false, NULL, false, false, 11),
  ('20000000-0000-4000-8000-000000000012', 'Acconciatura', NULL, 60, 38.00, true, 'A', 'Acconciatura', '#8B5CF6', true, true, 0, false, false, 12),
  ('20000000-0000-4000-8000-000000000013', 'Acconciatura Sposa con 2 Prove', NULL, 165, 350.00, true, 'ASP', 'Acconciatura', '#8B5CF6', true, false, NULL, false, false, 13),
  ('20000000-0000-4000-8000-000000000014', 'Pacchetto Sposa', NULL, 165, 500.00, true, 'PS', 'Acconciatura', '#8B5CF6', true, false, NULL, false, false, 14),

  ('20000000-0000-4000-8000-000000000015', 'Regolazione Barba', NULL, 15, 10.00, true, 'RB', 'Barba', '#B45309', true, true, NULL, false, false, 15),

  ('20000000-0000-4000-8000-000000000016', 'Colore', NULL, 15, 10.00, true, 'C', 'Colore', '#DC2626', true, false, NULL, false, false, 16),
  ('20000000-0000-4000-8000-000000000017', 'Colore Lunghezze', NULL, 45, 10.00, true, 'CL', 'Colore', '#DC2626', true, false, NULL, false, false, 17),
  ('20000000-0000-4000-8000-000000000018', 'Colore Lunghezze Promo Flash', NULL, 45, 55.00, true, 'CPF', 'Colore', '#DC2626', true, false, NULL, false, false, 18),
  ('20000000-0000-4000-8000-000000000019', 'Colore Radice', NULL, 30, 35.00, true, 'CR', 'Colore', '#DC2626', true, true, 30, false, false, 19),
  ('20000000-0000-4000-8000-000000000020', 'Tonalizzante', NULL, 15, 25.00, true, 'TZ', 'Colore', '#DC2626', true, true, NULL, false, false, 20),
  ('20000000-0000-4000-8000-000000000021', 'Effetti Promo Capelli Lunghi', NULL, 210, 90.00, true, 'EP', 'Colore', '#DC2626', true, false, NULL, false, false, 21),

  ('20000000-0000-4000-8000-000000000022', 'Trattamento Cute Sensibile', NULL, 30, 19.00, true, 'TCS', 'Trattamenti', '#059669', true, false, NULL, false, false, 22),
  ('20000000-0000-4000-8000-000000000023', 'Trattamento Anticaduta', NULL, 30, 33.00, true, 'TAC', 'Trattamenti', '#059669', true, false, NULL, false, false, 23),
  ('20000000-0000-4000-8000-000000000024', 'Trattamento Antiforfora', NULL, 45, 28.00, true, 'TAF', 'Trattamenti', '#059669', true, false, NULL, false, false, 24),
  ('20000000-0000-4000-8000-000000000025', 'Trattamento Antisebo', NULL, 45, 28.00, true, 'TAS', 'Trattamenti', '#059669', true, false, NULL, false, false, 25),
  ('20000000-0000-4000-8000-000000000026', 'Trattamento Argan', NULL, 15, 10.00, true, 'TA', 'Trattamenti', '#059669', true, false, NULL, false, false, 26),
  ('20000000-0000-4000-8000-000000000027', 'Trattamento Fiala', NULL, 15, 6.00, true, 'TF', 'Trattamenti', '#059669', true, false, NULL, false, false, 27),
  ('20000000-0000-4000-8000-000000000028', 'Trattamento Repair', NULL, 15, 20.00, true, 'TR', 'Trattamenti', '#059669', true, false, NULL, false, false, 28),
  ('20000000-0000-4000-8000-000000000029', 'Trattamento Ristrutturante', NULL, 15, 24.00, true, 'TRI', 'Trattamenti', '#059669', true, false, NULL, false, false, 29),
  ('20000000-0000-4000-8000-000000000030', 'Trattamento Specifico', NULL, 105, 66.00, true, 'TS', 'Trattamenti', '#059669', true, false, NULL, false, false, 30),
  ('20000000-0000-4000-8000-000000000031', 'Hair Spa', NULL, 15, 10.00, true, 'HS', 'Trattamenti', '#059669', true, false, NULL, false, false, 31),
  ('20000000-0000-4000-8000-000000000032', 'Maschera per Capelli', NULL, 15, 6.00, true, 'MC', 'Trattamenti', '#059669', true, false, NULL, false, false, 32),
  ('20000000-0000-4000-8000-000000000033', 'Auxilia Cute Sensibile', NULL, 15, 18.00, true, 'ACS', 'Trattamenti', '#059669', true, false, NULL, false, false, 33),
  ('20000000-0000-4000-8000-000000000034', 'Fiala Calmante', NULL, 15, 8.00, true, 'FC', 'Trattamenti', '#059669', true, false, NULL, false, false, 34),
  ('20000000-0000-4000-8000-000000000035', 'Ricostruzione del Capello', NULL, 60, 36.00, true, 'RC', 'Trattamenti', '#059669', true, false, NULL, false, false, 35),
  ('20000000-0000-4000-8000-000000000036', 'Scrub Cuoio Capelluto', NULL, 45, 35.00, true, 'SCC', 'Trattamenti', '#059669', true, false, NULL, false, false, 36),
  ('20000000-0000-4000-8000-000000000037', 'Spa Completo con Piastra', NULL, 30, 10.00, true, 'SCP', 'Trattamenti', '#059669', true, false, NULL, false, false, 37),

  ('20000000-0000-4000-8000-000000000038', 'Trattamento Cheratina (Capelli Corti)', NULL, 180, 240.00, true, 'TC', 'Cheratina', '#D97706', true, false, NULL, false, false, 38),
  ('20000000-0000-4000-8000-000000000039', 'Trattamento Cheratina (Capelli Lunghi)', NULL, 210, 306.00, true, 'TCL', 'Cheratina', '#D97706', true, false, NULL, false, false, 39),

  ('20000000-0000-4000-8000-000000000040', 'Trattamento Extra Shine Mani', NULL, 15, 10.00, true, 'ESM', 'Mani', '#DB2777', true, false, NULL, false, false, 40)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  duration_minutes = EXCLUDED.duration_minutes,
  price = EXCLUDED.price,
  active = EXCLUDED.active,
  short_name = EXCLUDED.short_name,
  category = EXCLUDED.category,
  category_color = EXCLUDED.category_color,
  is_bookable_online = EXCLUDED.is_bookable_online,
  is_quick_choice = EXCLUDED.is_quick_choice,
  posa_minutes = EXCLUDED.posa_minutes,
  has_variants = EXCLUDED.has_variants,
  sanificazione = EXCLUDED.sanificazione,
  display_order = EXCLUDED.display_order;

-- Verifiche rapide incluse nella migrazione.
DO $$
DECLARE
  service_count integer;
  operator_count integer;
BEGIN
  SELECT count(*) INTO service_count
  FROM public.services
  WHERE id BETWEEN '20000000-0000-4000-8000-000000000001'::uuid
              AND '20000000-0000-4000-8000-000000000040'::uuid;
  SELECT count(*) INTO operator_count
  FROM public.operators
  WHERE id IN (
    '10000000-0000-4000-8000-000000000001'::uuid,
    '10000000-0000-4000-8000-000000000002'::uuid
  );
  IF service_count <> 40 OR operator_count <> 2 THEN
    RAISE EXCEPTION 'Seed incompleto: % servizi, % operatori',
      service_count, operator_count;
  END IF;
  RAISE NOTICE 'Seed OK: 40 servizi, 2 operatori, 5 giorni di lavoro per Gianluca.';
END;
$$;

COMMIT;
