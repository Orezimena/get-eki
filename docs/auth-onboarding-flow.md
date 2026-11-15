# Feature 02A: authentication routing and trader onboarding

Base: remote main `8033131711e06ebb539b57531689eef3bbd88d2b`.
Branch: `feature/auth-onboarding-flow`.

## Behaviour

- Public landing pages, market listings and market details remain public. No global onboarding redirect was introduced.
- Login waits for the session, profile and role requests. A missing/incomplete profile goes to onboarding; a completed profile resumes the validated internal `returnTo`, falling back to `/markets`.
- Completion requires `onboarded = true` plus a category and region from the existing supported lists. A legacy profile with valid fields but `onboarded = false` must finish setup once.
- Direct review access and account settings share the trader gate. While loading, on errors or before completion, their forms are not mounted. Account changes remount protected forms to discard previous account drafts.
- Review sign-in/sign-up links carry the destination through authentication. Signup preserves it in its existing onboarding return URL when supplied; standard signup retains the original URL. Verification screen sign-in links preserve it too. No email setting, template or provider changed.
- Onboarding inserts a missing profile or updates an existing one. Both request one returned row and validate its identity and completed values. Zero rows, denied writes, network failures and invalid returned values do not route or show success. Reload profile can recover from a lost response, trigger race or repaired permissions.
- Already completed users opening onboarding continue to their destination immediately after loading.
- Session/profile/role fetch failures show a retry state rather than looking like a missing profile. Late requests cannot overwrite a newer identity or logout state. Private vote/moderation queries are cancelled and removed on identity changes/logout; public caches remain available.
- Failed sign-out is reported. The profile and admin flag stay hidden until the account is loaded again or sign-out succeeds. Supabase sign-out scope and session persistence are unchanged.
- Destinations are deliberately limited to known product paths. External URLs, protocol-relative paths, encoded separators, auth loops and admin destinations fall back to `/markets`. Query strings/fragments are not resumed by this feature.

## Automated verification

Run with Node 24 and installed dependencies:

```sh
npm test
npm run test:auth
npx tsc --noEmit
npm run build
```

Implementation validation: `npm test` passed all 34 tests; TypeScript, formatting, `git diff --check` and the production build passed. Targeted ESLint reported zero errors and two Fast Refresh export warnings in the auth module. No live backend requests were used by these tests.

`tests/auth-flow.test.mjs` exercises the production auth state controller using injected, in-memory dependencies: incomplete/completed/missing profiles, verified saves, rejected/zero-row saves, invalid fields, session errors, retries, logout, account switching and delayed requests. It never calls Supabase.

`tests/auth-components.test.tsx` server-renders the production trader gate and public market directory. It checks form visibility for loading/error/incomplete/completed/anonymous states, preserved auth links and anonymous browsing. These are rendering checks, not browser effect or end-to-end login tests.

`tests/register-tsx.mjs` uses the already installed TypeScript compiler to run JSX and Vite-alias component tests under Node without adding packages. The existing review calculation and homepage tests run in the same suite.

## Separate database work required

This feature enforces the application journey. Browser checks do not prevent direct API calls. No SQL migration or live policy/data change is part of this branch.

Before writing a separate reviewed migration, inspect actual table definitions, triggers, grants and all existing policies. They are not fully represented in this repository. In particular:

1. Review INSERT must require an authenticated identity with `reviews.user_id = auth.uid()`, an existing completed profile with valid required fields, and pending initial status. Ordinary users must not approve reviews, forge ownership or modify counters. Check overlapping permissive policies; adding a new permissive policy alone may not tighten access.
2. Profile SELECT/INSERT/UPDATE must restrict access to the owner. Missing-profile creation here requires owner INSERT permission, including permission to read the returned row. Existing saves need owner UPDATE and SELECT. If self-insert is intentionally forbidden, use a reviewed authenticated backend repair function instead; do not expose a service-role key.
3. Require valid category/region when a profile is marked onboarded. Ensure supported values match the application. Do not rely on a browser-supplied Boolean alone.
4. Verify the auth-user profile trigger is reliable, idempotent and has a safe execution context. Inspect existing missing rows before considering any backfill; no backfill is performed here.
5. Preserve intended public market/approved-review access and existing administrator moderation access. Test policies directly as anonymous, incomplete, completed and admin users in an isolated backend.

## Backend/browser acceptance still required

No live signup, login, email, profile save or review write was executed during implementation.

- Validate owner profile insert/update plus returned-row SELECT against actual RLS. Ensure missing-row repair and a simultaneous signup trigger fail safely; Reload profile should recover if the trigger won the insert race.
- Check login with confirmed new and returning accounts, refreshing during onboarding, cross-tab logout and account switching.
- Confirm slow/failed profile and role requests never expose a protected form and retry works.
- Confirm an incomplete user entering `/markets/<slug>/review` goes through setup and returns to that review after a verified save.
- Confirm completed users opening `/onboarding` skip setup and public browsing works while signed out or after a profile fetch error.
- Confirm signup email redirects retain an optional validated `returnTo` on production and preview. Existing email configuration and preview hosting restrictions remain outside this feature; query-bearing redirect URLs must be allowed by the current backend configuration.
- Test network failure after a committed save: no success is claimed for a failed response; Reload profile should discover a successfully saved row.
- Verify direct API bypass attempts are rejected after the separate database migration. Until then, this branch is not proof of backend enforcement.

Email verification incidents, SMTP delivery, preview hosting, Google OAuth, password policy and Remember me remain separate workstreams. Nothing is deployed, published or merged by these changes.
