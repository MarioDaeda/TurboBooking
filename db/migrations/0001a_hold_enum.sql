-- Commit enum additions before using them in subsequent migrations.
ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'hold';
ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'expired';
