# Feature 02B: resend verification email

Base: main `52db30911203c3802081f07293b69b60ee781441`, which merged Feature 02A in PR #2.
Branch: `feature/resend-verification-email`.

## Behaviour and privacy

- `/verify-email` offers an explicit resend using `supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo } })`. Rendering the page never sends email.
- Signup stages its email and exact original confirmation return URL in tab-scoped session storage after a successful confirmation-required response. The verification page URL contains only the safe return destination. Passwords and tokens are never staged, and provider errors/addresses are not logged by this feature.
- Context expires after one hour and is cleared when next read, or disappears when the browser ends the tab session. Immediate-session signup clears the previous pending context. Storage is origin-scoped, so preview and production do not share it. When storage is blocked/full, a memory fallback keeps navigation working; a full refresh can lose that fallback. Missing/expired context offers a return to signup instead of guessing an address.
- The current history entry is scrubbed if someone opens a legacy verification URL containing `email`; this cannot remove records already held by servers or older browser history. The legacy URL email is not used as a resend target.
- The confirmation destination is unchanged: current-origin `/onboarding`, plus the existing safe optional `returnTo`. Resend reuses the exact destination staged at signup, rather than accepting a destination from the current page URL.
- Successful confirmation-required signup starts a 60-second countdown immediately; each successful resend restarts it. The countdown says "You can request another email in 60 seconds." It updates as time elapses and is retained across same-tab refresh when storage works. A synchronous pending guard prevents duplicate in-flight clicks. Time is calculated from an absolute deadline, so background-tab timer delays do not extend the countdown.
- HTTP 429 and Supabase email/request-rate-limit codes show "Please wait a little longer before trying again." These responses also start a 60-second retry cooldown. Provider limits may last longer, including after the original signup email. This browser cooldown is a usability control; the provider enforces real sending limits.
- Success says a link has been requested _if_ an account awaits verification. It does not assert account existence or inbox delivery. Other errors use generic retry text without provider details.
- Wrong addresses can be corrected by returning to signup, with the intended safe review destination preserved. This does not modify the earlier account's email.
- Native disabled buttons, status/alert feedback, a described visible countdown without per-second live announcements, wrapped button labels and long-email wrapping support keyboard, screen-reader and narrow-screen use.

## Validation

Automated tests use injected provider functions and deterministic clocks, plus component server rendering. They do not send real emails or use live Supabase. The existing 34 authentication, onboarding, review and homepage tests remain part of `npm test`.

Run:

```sh
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Validation result: all 54 automated tests, TypeScript, targeted ESLint, formatting, whitespace checks and the production build passed.

Repository-wide lint has an existing baseline failure: 369 formatting errors and eight warnings. The final feature lint output was identical to an archived checkout of main after normalizing paths. Targeted lint for this feature is clean. Unrelated formatting is intentionally excluded.

No password-reset, sign-in, onboarding, database policy, email-template or live configuration changes are included. No deployment, publication or merge is performed.

## Manual Lovable acceptance checklist (not executed)

- [ ] On desktop and a narrow mobile screen, sign up using a fresh Mailinator address. Confirm the initial email arrives and the verification page has no email in its URL.
- [ ] Immediately after signup, confirm resend is disabled with "You can request another email in 60 seconds." Refresh in the same tab and verify the remaining countdown is retained. After it expires, click resend; confirm neutral feedback and a fresh 60-second countdown. Rate limits should say "Please wait a little longer before trying again."
- [ ] Repeatedly click/tap while pending and cooling down; confirm only one request is made. Refresh in the same tab during cooldown; confirm the remaining time is retained. Wait until zero; confirm resend becomes available.
- [ ] Open the resent verification link and confirm it returns directly to Eki. Check both ordinary signup and signup originating from a review URL. Complete mandatory onboarding and resume the intended destination; completed traders should skip setup.
- [ ] Open `/verify-email` in a separate tab without signup context, or with expired context. Confirm resend is disabled and signup remains available. Test blocked browser storage; same-page fallback should work, while refresh may require signup again.
- [ ] Use Wrong email address / Return to signup; complete signup with the corrected address. Confirm subsequent resend targets that address and the review destination is retained.
- [ ] Simulate offline/provider failures in browser tools. Confirm generic accessible feedback, no provider details, no stuck busy state and a usable retry. Do not deliberately exhaust a live provider quota to test rate limits.
- [ ] With keyboard and a screen reader, verify focus visibility, button activation, feedback announcements and that the countdown does not announce every second. Check long email addresses and 200% zoom for overflow.
- [ ] Regression-check password login, public market browsing, mandatory onboarding and the existing Forgot Password/reset journey. No password-reset code changed in this branch.

Backend email delivery and redirect-allowlist behaviour still need the manual checks above; automated tests cannot establish inbox delivery.
