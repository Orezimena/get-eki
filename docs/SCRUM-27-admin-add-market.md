# SCRUM-27: admin market creation and editing

Implementation and migration are local only. Do not apply the migration or create
production listings until separately approved.

## MVP scope

The form requires name, city/town, venue/address, region, market type and a URL
slug suggested from name + city. Description and a minimum/maximum stall fee pair
are optional. Organiser, frequency, hours, typical days, postcode and accepted
categories are also optional. Blank text saves as NULL and blank categories as
an empty list; editing prepopulates their current values.
The listing becomes public immediately. Manage Markets lists existing records
with Edit buttons and reuses the same form. All supported descriptive fields,
organiser, postcode, categories, frequency, typical days and hours can be edited.
Market ID, creation date and URL slug are immutable. No deletion is introduced.

Exact duplicates mean the same name + city + venue/address, ignoring case and
normalising whitespace. Different venues can share a market name and city but
must use different slugs. Near duplicates, abbreviations and spelling variants
need an administrator's judgement; fuzzy matching is outside this MVP.

Preflight checks improve feedback; UNIQUE indexes prevent concurrent inserts
from bypassing duplicate checks. INSERT/UPDATE returns only id + slug and must return a
valid matching row before success. UPDATE targets the original ID and slug;
duplicate checks exclude the current ID. The returned ID must equal the original
ID, and zero-row updates are failures. No review table mutations are performed. No automatic retry after an ambiguous result.
A shared admin gate protects both routes. The private form unmounts on logout/account change; late results do not update its UI.

## Unknown fees

Use NULL for both fees and show "Stall fee not confirmed". Explicit zero means a
confirmed free stall. Enter both known bounds (equal amounts are permitted).
Unknown fees remain visible with "Any" price, but cannot satisfy a price cap.
The old Any filter also incorrectly excluded prices above £100; Any now means no
price constraint. Fees are stored and entered in whole pounds (GBP), not pence. Fractional
amounts are rejected before INSERT/UPDATE; no multiplication, division or
rounding conversion is performed. The form uses step=1 to match int4 columns.
No existing zero or other value is reinterpreted or updated.

Generated market types are adjusted to the proposed nullable schema. Regenerate
from the approved database schema after migration. The new UI must not launch
before migration approval/application and verification.

## Supplied deployed inspection results (21 November 2026)

The product owner confirmed: integer identity ID using public.markets_id_seq;
fee columns int4, NOT NULL/default 0; 12 markets, zero invalid fee ranges and
zero both-zero ranges; only primary-key and exact-slug unique constraints/indexes;
no normalised slug or identity duplicates; markets RLS enabled, FORCE disabled;
only a public SELECT markets policy; only an authenticated own-role SELECT
user_roles policy; broad markets API-role grants; no custom markets triggers;
has_role(uuid, app_role) is SECURITY DEFINER with search_path=public and checks
user_roles; ordinary API roles neither superuser nor BYPASSRLS and have no direct
inherited memberships. These are supplied findings, not SQL executed by Codex.

The migration preserves public reads, revokes destructive market grants (notably
TRUNCATE, which bypasses RLS, and PostgreSQL 17 MAINTAIN), removes direct column grants that table revocations
do not remove, and permits INSERT/UPDATE only through admin RLS. UPDATE grants
exclude id, slug and created_at. It also removes ordinary role-table write,
truncate and column-write grants, ensures user_roles RLS is enabled without
changing its own-role SELECT policy (anonymous table/column SELECT is removed), and removes sequence UPDATE permission
while retaining authenticated USAGE. The known read-only has_role helper is
granted to authenticated and revoked from PUBLIC/anon explicitly. Trusted owner/service-role operations are
not an authorisation test and remain outside ordinary browser roles.

Dropping fee defaults/NOT NULL leaves all existing values untouched, including
zero. All 12 inspected fee ranges are valid. The CHECK is now created fully
validated (without NOT VALID), so PostgreSQL scans existing rows on application.
Any invalid drift causes the entire transaction to fail instead of silently
repairing data. With this small table there is no justification for deferring
validation. Future INSERT/UPDATE operations must satisfy the same paired-NULL or
non-negative ordered range rule.

The existing exact-slug constraint is retained without changing any dependencies;
normalised uniqueness is additional, not identical. All DDL stays in one
transaction: concurrent conflicting writes during deployment may make index
creation fail and roll back. Recheck data immediately before application.

No custom markets triggers were reported, so the known migration/application
code has no review-write path. Remaining checks are function privileges and
bodies, schema CREATE rights, exact fee numeric types, user_roles effective
privileges/RLS and any new drift after inspection. Inspect all API-exposed
schemas, not just public, if the deployment exposes more schemas.

## Database review required before applying

Repository migrations do not contain the markets DDL, policies or trigger bodies.
Use the actual target database SQL interface to inspect metadata first:

```sql
SELECT column_name, data_type, is_nullable, column_default, is_identity
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'markets'
ORDER BY ordinal_position;

SELECT conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint WHERE conrelid = 'public.markets'::regclass;

SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'markets';

SELECT relrowsecurity, relforcerowsecurity
FROM pg_class WHERE oid = 'public.markets'::regclass;

SELECT policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname = 'public'
AND tablename IN ('markets', 'user_roles');

SELECT grantee, privilege_type FROM information_schema.table_privileges
WHERE table_schema = 'public' AND table_name = 'markets';

SELECT grantee, column_name, privilege_type
FROM information_schema.column_privileges
WHERE table_schema = 'public' AND table_name = 'markets';

SELECT tgname, pg_get_triggerdef(oid) FROM pg_trigger
WHERE tgrelid = 'public.markets'::regclass AND NOT tgisinternal;

SELECT p.oid::regprocedure, p.prosecdef, p.proconfig,
       pg_get_functiondef(p.oid)
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'has_role' AND p.prokind = 'f';

SELECT rolname, rolsuper, rolbypassrls FROM pg_roles
WHERE rolname IN ('anon', 'authenticated');

SELECT pg_get_serial_sequence('public.markets', 'id');

SELECT r.role_name, a.attname,
       has_column_privilege(r.role_name, 'public.markets', a.attname, 'UPDATE')
         AS effective_update
FROM (VALUES ('anon'), ('authenticated')) AS r(role_name)
CROSS JOIN pg_attribute a
WHERE a.attrelid = 'public.markets'::regclass
  AND a.attnum > 0 AND NOT a.attisdropped
ORDER BY r.role_name, a.attnum;

SELECT member::regrole AS member_role, roleid::regrole AS inherited_role
FROM pg_auth_members
WHERE member IN ('anon'::regrole, 'authenticated'::regrole);

-- Effective privileges: these checks include grants to PUBLIC.
SELECT r.role_name, t.table_name,
       has_table_privilege(r.role_name, 'public.' || t.table_name, 'INSERT') AS can_insert,
       has_table_privilege(r.role_name, 'public.' || t.table_name, 'UPDATE') AS can_update,
       has_table_privilege(r.role_name, 'public.' || t.table_name, 'DELETE') AS can_delete,
       has_table_privilege(r.role_name, 'public.' || t.table_name, 'TRUNCATE') AS can_truncate
FROM (VALUES ('anon'), ('authenticated')) AS r(role_name)
CROSS JOIN (VALUES ('markets'), ('user_roles')) AS t(table_name);

SELECT r.role_name, a.attname,
       has_column_privilege(r.role_name, 'public.user_roles', a.attname, 'INSERT') AS can_insert,
       has_column_privilege(r.role_name, 'public.user_roles', a.attname, 'UPDATE') AS can_update
FROM (VALUES ('anon'), ('authenticated')) AS r(role_name)
CROSS JOIN pg_attribute a
WHERE a.attrelid = 'public.user_roles'::regclass
  AND a.attnum > 0 AND NOT a.attisdropped;

SELECT relname, relowner::regrole AS table_owner, relrowsecurity, relforcerowsecurity
FROM pg_class WHERE oid IN ('public.markets'::regclass, 'public.user_roles'::regclass);

SELECT r.role_name,
       has_schema_privilege(r.role_name, 'public', 'CREATE') AS can_create_in_public,
       has_sequence_privilege(r.role_name, 'public.markets_id_seq', 'UPDATE') AS can_set_sequence
FROM (VALUES ('anon'), ('authenticated')) AS r(role_name);

-- Review definitions locally: a privileged RPC could bypass table grants/RLS.
SELECT p.oid::regprocedure AS function_name, p.proowner::regrole AS owner,
       p.prosecdef, p.proconfig,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
       pg_get_functiondef(p.oid) AS definition
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prokind = 'f' AND p.prosecdef;

-- Aggregate only: verify all existing rows will pass immediate validation.
SELECT count(*) AS invalid_legacy_fee_ranges
FROM public.markets
WHERE stall_fee_min < 0 OR stall_fee_max < stall_fee_min
   OR (stall_fee_min IS NULL) <> (stall_fee_max IS NULL);
```

Confirm existing public SELECT policies, anonymous/authenticated SELECT grants,
admin SELECT access for INSERT/UPDATE RETURNING, compatible remaining field constraints/defaults (fee int4 types and whole-pound
application units are now confirmed),
and the has_role helper and role-assignment protection. Ordinary API roles must
not bypass RLS. Review any triggers and their functions. Determine whether an
existing unique constraint already enforces each key; remove redundant new
indexes from the proposal before approval if appropriate. Unique index creation
will fail/roll back on existing duplicates; do not modify those records without
separate approval. Confirm new policy/constraint/index names are unused.

## Isolated testing and approval sequence

1. Provision an isolated Supabase/PostgreSQL test database matching inspected
   schema, grants, policies and triggers. The repository alone cannot recreate it.
2. Apply this migration atomically there. Verify rollback on duplicate fixtures.
3. Use actual anon, ordinary trader and admin JWT API requests (never postgres or
   a service role for authorisation tests). Only the admin may INSERT. Check the
   administrator cannot be self-assigned by a trader. Verify ordinary traders
   remain denied even if an old permissive INSERT/UPDATE/ALL policy exists.
   Test UPDATE denial for trader/anon directly, and verify admins cannot change
   id, slug or created_at through ordinary API grants (including inherited grants).
4. Admin creates a known-fee and unknown-fee test listing; assert saved values,
   returned row, public directory/detail display, fee filtering and cache refresh.
5. Test duplicate normalised identities, slug collisions and concurrent inserts:
   exactly one creation succeeds, with no false UI success on a denied/zero-row
   result. Confirm fractional fees are rejected, and test confirmed free fees and invalid ranges.
6. Test mobile/desktop, keyboard labels, loading/errors, duplicate clicks, logout
   or account switching during a delayed request and no stale success screen.
7. After review and separate approval, apply to Lovable Cloud; verify effective
   RLS and public read compatibility before shipping the UI. No production test
   inserts are authorised by this implementation task.

## UPDATE compatibility assessment (not verified live)

The prepared migration adds restrictive + permissive admin UPDATE policies with
both USING and WITH CHECK. It revokes ordinary table/column UPDATE grants, then
grants authenticated UPDATE only on editable fields. Review inherited role
grants too: direct revocation alone cannot remove permissions inherited from
another role. No SELECT/DELETE policies or review policies are changed. DELETE/TRUNCATE grants
are revoked; those are distinct from policies.

Compatibility is conditional until deployed metadata is reviewed. In particular:

- Existing restrictive policies may still deny admins; adding a permissive
  policy does not override them.
- Existing unique indexes may make proposed indexes redundant, or historical
  duplicate rows may prevent installation. No automated cleanup is authorised.
- The fee CHECK validates existing rows during installation. Current inspection
  found zero invalid ranges; changed invalid data aborts the migration.
- Existing triggers may alter fields or touch reviews. Inspect their function
  definitions before any real edit; frontend code alone cannot rule this out.
- Editable values must fit deployed column types, lengths and CHECK constraints.
  Existing values outside form validation lengths or fee limits may need explicit
  correction before saving. Unchanged legacy regions and slugs are preserved;
  newly selected regions use the existing supported list.
- There is no updated_at/version column in the generated schema. Concurrent
  administrators use last-save-wins for descriptive fields; stale drafts are
  not silently refreshed. Avoid simultaneous editing of the same market.

Manually test prepopulation for every field, clear optional fields to NULL/empty
categories, preserve NULL vs zero fees, and verify UPDATE retains the exact
market ID/slug and existing review foreign keys/content. Confirm names refresh
in the directory, detail pages, organiser pages and embedded My Reviews results.
The shared markets query and private My Reviews queries are invalidated after a
verified save. Test database failures, zero-row saves, duplicate clicks and
account changes while saving.

## Rollback

Prefer reverting the feature UI while retaining admin-only INSERT enforcement.
Any schema rollback requires separate review: do not restore NOT NULL if new
unknown-fee rows exist, and never convert them to zero. Restore old grants,
policies and defaults only from captured pre-migration metadata; do not simply
remove the restrictive guard and accidentally reopen a broad INSERT policy.
No destructive down migration is included.

## Validation limits

Automated tests mock database interactions and render components on the server;
they do not prove deployed RLS, real browser click/focus behaviour, database
uniqueness races, identity allocation or cache refresh against a live backend.
Those are isolated/manual acceptance gates above. No live migration or data
mutation has been executed.

## Controlled application decision

GO for an isolated controlled migration trial and real-role tests; the SQL has
not been executed or runtime-validated here. NO-GO for production approval until
remaining table-owner/privileged-function/schema checks are reviewed. Neither
API role may own markets or user_roles: a table owner bypasses non-FORCE RLS
even without the BYPASSRLS flag. A SELECT-only
user_roles policy plus revoked direct write privileges blocks ordinary direct
self-assignment, but does not prove no SECURITY DEFINER RPC, hook or writable
schema can bypass it. has_role is a membership-check helper, not a role-grant API;
review its exact body/qualified references and callable write-capable functions.
A search_path=public setting alone does not establish that schema lookup is safe
from untrusted CREATE or temporary-schema shadowing. Do not blanket-revoke all
functions or alter hooks without reviewing authentication dependencies.

After a separately approved controlled application, verify anon public SELECT,
trader INSERT/UPDATE denial, admin INSERT/UPDATE success, immutable-column denial,
role-table self-assignment denial and effective DELETE/TRUNCATE revocations.
Never test TRUNCATE or destructive grants on production records: inspect effective
privileges there and use disposable fixtures only in isolation. Test duplicate
races, NULL/free fees, legacy invalid edits and unchanged review associations.

## Signup hook security correction

The product owner supplied the deployed postgres-owned handle_new_user() body and
its enabled on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW trigger.
The hook granted admin when no administrator existed, even though two current
admin assignments mean that branch is not currently needed. The vulnerability
would return if all admins were removed; signup must never bootstrap authority.

The same unapplied migration now CREATE OR REPLACEs this zero-argument trigger
function, removing only the first-admin conditional block. The exact profile
insert (id/email, ON CONFLICT(id) DO NOTHING), ordinary user insert (ON CONFLICT
DO NOTHING), RETURN NEW, language, SECURITY DEFINER and search_path are retained.
Existing owner and trigger dependency remain in place; no trigger recreation or
account/role backfill occurs. Direct EXECUTE is explicitly revoked from PUBLIC,
anon and authenticated. PostgreSQL trigger invocation does not require those
browser roles to have direct function EXECUTE permission; the existing trusted
signup path and postgres-owned function must still be tested in isolation.

Existing counts (2 admin, 10 user) are supplied evidence, not a migration target:
no current role is deleted, replaced, promoted or demoted. New registrations get
only user from this hook regardless of whether admins exist or signup metadata
requests admin. Future admin assignments must be deliberate trusted-operator
operations outside this UI and ordinary API roles, using a verified account ID
and an auditable reviewed grant; do not restore a first-admin bootstrap branch.

Structural tests verify the exact replacement body and compatible signature,
absence of any admin/metadata branch, no trigger replacement and no top-level
account/role DML. They do not execute PostgreSQL or prove real signup succeeds.
In isolation, test signup with zero and multiple admins, malicious role metadata,
profile defaults/email preservation, the ordinary role, trigger activation and
unchanged pre-existing accounts/admin assignments. Review any other auth.users
triggers or privileged RPCs for independent role-grant paths. The fix is effective
only after approved successful application: failure elsewhere in the combined
transaction rolls it back too. No migration or signup test has run against live data.
