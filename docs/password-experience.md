# SCRUM-8: password experience — safe local implementation

Base: latest fetched main `d607b2f` (Feature 02B merged).
Branch: `feature/password-experience`. Local changes only; no push, PR or deployment.

## Included diff

- Shared `PasswordInput`: independently masked fields with native non-submit Show/Hide buttons, descriptive accessible names, `aria-controls` and `aria-pressed`, forwarded input props/ref, disabled states and password-manager autocomplete. Clearing a field masks it again. Native keyboard activation and paste remain available.
- Shared feedback/validation: preserve the existing six-character minimum and matching confirmation. Show real-time minimum-length and confirmation feedback. Reaching the minimum is explicitly not labelled strong; a longer, unique passphrase is advice rather than an invented requirement.
- Apply these controls to signup, regular sign-in, reset/update password and admin sign-in. All password fields found in the repository are covered.
- Forms have inline alert errors, busy states and try/finally cleanup. Editing a field clears stale submission errors. Provider password errors map to safe text rather than echoing raw messages; no passwords are logged, stored outside existing form state, or sent to an external strength service.
- Keep existing Supabase calls and destinations: signup still stages private verification context and opens verification/onboarding, sign-in still waits for profile routing, and password update still calls `updateUser` and returns to markets. Forgot Password, resend, onboarding and the session client/storage are unchanged.

## Password policy evidence and limits

The original signup and reset code enforced six characters. In this conversation the owner previously verified Supabase's minimum as six and HIBP compromised-password checking as enabled. Repository `supabase/config.toml` does not define these live settings, and no management connection was available to independently recheck them. The shared minimum reflects that evidence; it does not change Supabase policy.

The browser cannot establish that a password is uncompromised. Supabase remains authoritative on submission; `weak_password` receives actionable advice. No uppercase, lowercase, number, symbol, maximum-length or strength-score requirement is invented. The feedback deliberately describes minimum compliance and strength advice rather than claiming an entropy calculation or guaranteed backend acceptance. Verify settings still match before beta release.

## Remember me: intentionally not implemented

Per the ticket instruction to stop before coding a risky storage change, no checkbox or storage modification is included. Sessions continue to use their existing persistence behaviour. This is a partial SCRUM-8 implementation, not completion of Remember me.

Evidence:

- `src/integrations/supabase/client.ts` constructs a singleton with `persistSession: true`, `autoRefreshToken: true` and `brokeredPreviewStorage()`. AuthProvider restores it before a sign-in choice can be made.
- `previewAuthStorage.ts` uses localStorage outside selected embedded previews. Inside those previews the editor broker also seeds localStorage and synchronizes sessions between preview surfaces.
- The broker's get/set/remove protocol contains no session-scoped persistence mode. Swapping only the login write destination would leave old persistent copies available for restoration. Refresh callbacks and other tabs could copy them back.
- OAuth is not implemented yet. Future OAuth/PKCE, email verification and recovery callbacks must nevertheless have defined storage defaults and transaction-state handling. These working email/recovery flows should not be changed incidentally.

Options requiring a storage-design decision and browser validation:

1. **Broker-aware storage adapter:** select storage before SDK session initialization/writes; store an explicit per-tab non-persistent preference; define treatment of existing persistent sessions; migrate/delete only this project's session and callback keys; prevent broker reads/writes from restoring an opted-out session; handle token refresh, logout across stores and account changes. This preserves preview synchronization only if the broker supports the chosen semantics.
2. **Separate preview storage model:** bypass the editor broker for session-scoped logins and use sessionStorage, retaining persistent storage for explicit opt-in. Decide how preview-wide logout/login synchronization should change and how old broker sessions are removed without disrupting another active surface. This changes preview behaviour and needs explicit acceptance.

In either design, default new password logins to unchecked/session-scoped persistence, apply changes transactionally around failed logins, define callback defaults, and test browser restart, cross-tab/account changes and logout. A persistent choice permits storage across restarts; backend expiry/revocation can still end the session. Some browsers restore sessionStorage with restored tabs, so browser-close guarantees must not be overstated. No production changes should be made as part of the design review.

## Automated validation

- `npm test`: 64 passing tests (existing 54 plus ten focused password tests).
- TypeScript, targeted ESLint, formatting, production build and whitespace checks: passed.
- Full repository lint baseline on an archived main checkout: 369 formatting errors and eight warnings. This branch: 367 formatting errors and eight warnings; the two removed findings were existing formatting in the touched admin file. No new lint findings.

Tests cover existing minimum/matching rules, generic provider-error mapping, no password echo in feedback, masked default controls, non-submit toggle semantics, disabled controls, autocomplete, accessible descriptions, live-feedback states and all four production form renderings. Existing auth, onboarding, resend, redirect-privacy, review and public browsing tests still run. No live accounts, emails, password updates or backend settings are used.

Component tests use server rendering; they do not exercise browser click/focus/autofill or actual Supabase submission. Before release, manually check:

- Independent Show/Hide with mouse and keyboard on all six password inputs; visible labels and screen-reader state; inputs remain masked initially and after being cleared.
- Minimum/matching feedback as users type, including editing after an error, and long passphrases/paste/password-manager autofill.
- Slow/failed signup, sign-in and reset submission; errors are announced and controls become usable again.
- Initial verification, resend cooldown, recovery link/password update and mandatory onboarding still work on production-style and preview origins.
- Narrow screens, 200% zoom and visible focus indicators.

No Remember me acceptance claim is made. Its browser/backend tests must follow the separate storage decision.
