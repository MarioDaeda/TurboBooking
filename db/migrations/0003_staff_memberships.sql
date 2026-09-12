-- Apply once to both new databases and existing validated v1.2 projects.
BEGIN;
CREATE TABLE public.staff_memberships (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  operator_id uuid NOT NULL REFERENCES public.operators(id) ON DELETE RESTRICT,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.staff_memberships ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.staff_memberships FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.staff_memberships TO service_role;
-- Only the database administrator provisions membership; never from user metadata.
-- Compatibility with the original v1 operators table (backend orders by sort_order).
ALTER TABLE public.operators ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
NOTIFY pgrst, 'reload schema';
COMMIT;
