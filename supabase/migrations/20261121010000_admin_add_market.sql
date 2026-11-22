-- SCRUM-27: PREPARED ONLY. Do not apply until deployed metadata and existing
-- duplicates/constraints have been reviewed and this migration is approved.
-- Apply atomically. Does not UPDATE or DELETE existing market records.
BEGIN;

ALTER TABLE public.markets ENABLE ROW LEVEL SECURITY;
-- RLS does not protect TRUNCATE. Neither traders nor admins need destructive
-- market operations in this feature. Preserve the existing public SELECT policy.
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public.markets
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.markets TO anon, authenticated;

-- Admin authority must not be writable by a browser role. Keep the existing
-- authenticated own-role SELECT policy; trusted database/backend maintenance
-- remains outside these ordinary roles.
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
REVOKE SELECT ON public.user_roles FROM PUBLIC, anon;
GRANT SELECT ON public.user_roles TO authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON public.user_roles FROM PUBLIC, anon, authenticated;
DO $$
DECLARE column_list text;
BEGIN
  SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum) INTO column_list
  FROM pg_attribute WHERE attrelid = 'public.user_roles'::regclass
    AND attnum > 0 AND NOT attisdropped;
  EXECUTE format('REVOKE INSERT (%s), UPDATE (%s), REFERENCES (%s) ON public.user_roles FROM PUBLIC, anon, authenticated',
    column_list, column_list, column_list);
  EXECUTE format('REVOKE SELECT (%s) ON public.user_roles FROM PUBLIC, anon', column_list);
END $$;
-- Also remove column REFERENCES grants on markets; table REVOKE is insufficient.
DO $$
DECLARE column_list text;
BEGIN
  SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum) INTO column_list
  FROM pg_attribute WHERE attrelid = 'public.markets'::regclass
    AND attnum > 0 AND NOT attisdropped;
  EXECUTE format('REVOKE INSERT (%s), REFERENCES (%s) ON public.markets FROM PUBLIC, anon, authenticated',
    column_list, column_list);
END $$;
ALTER TABLE public.markets
  ALTER COLUMN stall_fee_min DROP NOT NULL,
  ALTER COLUMN stall_fee_max DROP NOT NULL,
  ALTER COLUMN stall_fee_min DROP DEFAULT,
  ALTER COLUMN stall_fee_max DROP DEFAULT;

-- Fees remain int4 amounts in whole GBP, not pence. NULL means unknown;
-- existing values (including any confirmed free zero) are not converted.
-- The inspected 12 markets all satisfy this CHECK. Validate existing rows now;
-- any conflicting concurrent/changed data aborts the transaction, without repair.
ALTER TABLE public.markets ADD CONSTRAINT markets_creation_fee_range_check
  CHECK (
    (stall_fee_min IS NULL AND stall_fee_max IS NULL)
    OR (stall_fee_min IS NOT NULL AND stall_fee_max IS NOT NULL
        AND stall_fee_min >= 0 AND stall_fee_max >= stall_fee_min)
  );

-- Fail safely if existing data conflicts; never clean up records automatically.
CREATE UNIQUE INDEX markets_creation_slug_key
  ON public.markets (lower(btrim(slug)));
CREATE UNIQUE INDEX markets_creation_identity_key
  ON public.markets (
    lower(btrim(regexp_replace(name, '[[:space:]]+', ' ', 'g'))),
    lower(btrim(regexp_replace(city, '[[:space:]]+', ' ', 'g'))),
    lower(btrim(regexp_replace(location, '[[:space:]]+', ' ', 'g')))
  );

REVOKE INSERT ON public.markets FROM PUBLIC, anon;
GRANT INSERT ON public.markets TO authenticated;

-- The read-only membership helper is needed by authenticated RLS checks.
-- Do not expose it to anonymous callers through a default PUBLIC EXECUTE grant.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- A restrictive policy ANDs with existing permissive INSERT/ALL policies,
-- preventing an older broad policy from allowing ordinary traders to insert.
CREATE POLICY markets_admin_insert_guard ON public.markets
  AS RESTRICTIVE FOR INSERT TO PUBLIC
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY markets_admin_insert_allow ON public.markets
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Restrict UPDATE even if a legacy permissive UPDATE/ALL policy exists.
REVOKE UPDATE ON public.markets FROM PUBLIC, anon, authenticated;
-- Remove direct column grants too; table-level REVOKE does not remove these.
DO $$
DECLARE column_list text;
BEGIN
  SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum) INTO column_list
  FROM pg_attribute WHERE attrelid = 'public.markets'::regclass
    AND attnum > 0 AND NOT attisdropped;
  EXECUTE format('REVOKE UPDATE (%s) ON public.markets FROM PUBLIC, anon, authenticated', column_list);
END $$;
GRANT UPDATE (name, city, location, region, type, organiser, description,
  frequency, hours, typical_days, postcode, categories_accepted,
  stall_fee_min, stall_fee_max) ON public.markets TO authenticated;
CREATE POLICY markets_admin_update_guard ON public.markets
  AS RESTRICTIVE FOR UPDATE TO PUBLIC
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY markets_admin_update_allow ON public.markets
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Grant only the markets id sequence if this deployment uses serial/identity.
DO $$
DECLARE market_sequence text;
BEGIN
  market_sequence := pg_get_serial_sequence('public.markets', 'id');
  IF market_sequence IS NOT NULL THEN
    -- Prevent direct setval() and destructive sequence resets by API roles.
    EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC, anon, authenticated', market_sequence);
    EXECUTE format('GRANT USAGE ON SEQUENCE %s TO authenticated', market_sequence);
  END IF;
END $$;

-- Replace the inspected signup hook in place: same zero-argument trigger
-- signature, language, security mode and search_path. CREATE OR REPLACE retains
-- the existing postgres owner and the on_auth_user_created trigger dependency.
-- No existing profiles, accounts or role assignments are changed by this DDL.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;

-- Trigger execution remains available to the trusted signup path; this is not
-- a browser-callable role-assignment RPC. Admin grants require trusted operators.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

COMMIT;
