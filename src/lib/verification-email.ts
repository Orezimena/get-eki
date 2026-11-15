import { z } from "zod";
import { safeReturnTo } from "./auth-flow.ts";

const STORAGE_KEY = "eki.pending-verification";
const RETENTION_MS = 60 * 60 * 1000;
export const RESEND_COOLDOWN_MS = 60_000;
export const RESEND_SUCCESS =
  "If this address has an account awaiting verification, a new link has been requested. Check your inbox and spam folder.";
const emailSchema = z.string().email().max(254);

export type VerificationTarget = {
  email: string;
  redirectTo: string;
  expiresAt: number;
  retryAt: number;
};
type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;

// Keep the working signup redirect identical for both the first email and resend.
export function verificationRedirect(origin: string, returnTo?: string): string {
  return `${origin}/onboarding${returnTo ? `?returnTo=${encodeURIComponent(safeReturnTo(returnTo))}` : ""}`;
}

export function createVerificationStorage(
  storage: () => Storage | undefined,
  origin: () => string,
  now = Date.now,
) {
  let memory: VerificationTarget | null = null;
  let memoryOnly = false;
  function clear() {
    memory = null;
    try {
      storage()?.removeItem(STORAGE_KEY);
    } catch {
      memoryOnly = true;
    }
  }
  function write(target: VerificationTarget) {
    memory = target;
    try {
      storage()?.setItem(STORAGE_KEY, JSON.stringify(target));
    } catch {
      // A failed write must not let an older stored cooldown override memory.
      memoryOnly = true;
    }
  }
  function read(): VerificationTarget | null {
    let target: unknown = memory;
    try {
      const saved = memoryOnly ? null : storage()?.getItem(STORAGE_KEY);
      if (saved) target = JSON.parse(saved);
    } catch {
      memoryOnly = true;
    }
    const parsed = z
      .object({
        email: emailSchema,
        redirectTo: z.string(),
        expiresAt: z.number().finite(),
        retryAt: z.number().finite(),
      })
      .safeParse(target);
    if (!parsed.success || parsed.data.expiresAt <= now()) {
      clear();
      return null;
    }
    try {
      const url = new URL(parsed.data.redirectTo);
      const expected = verificationRedirect(
        origin(),
        url.searchParams.get("returnTo") ?? undefined,
      );
      if (parsed.data.redirectTo !== expected) {
        clear();
        return null;
      }
    } catch {
      clear();
      return null;
    }
    return parsed.data;
  }
  return {
    read,
    write,
    clear,
    remember(email: string, redirectTo: string) {
      if (!emailSchema.safeParse(email.trim()).success) {
        clear();
        return;
      }
      write({
        email: email.trim(),
        redirectTo,
        expiresAt: now() + RETENTION_MS,
        retryAt: now() + RESEND_COOLDOWN_MS,
      });
    },
  };
}

// Access browser storage lazily; no email is read or rendered during SSR.
export const pendingVerification = createVerificationStorage(
  () => (typeof window === "undefined" ? undefined : window.sessionStorage),
  () => (typeof window === "undefined" ? "" : window.location.origin),
);

type ResendRequest = {
  type: "signup";
  email: string;
  options: { emailRedirectTo: string };
};
type ResendError = { status?: number; code?: string };
export type ResendState = {
  target: VerificationTarget | null;
  ready: boolean;
  pending: boolean;
  remaining: number;
  feedback: string | null;
  error: boolean;
};

export function createVerificationResend({
  storage,
  resend,
  now = Date.now,
}: {
  storage: ReturnType<typeof createVerificationStorage>;
  resend: (request: ResendRequest) => Promise<{ error: ResendError | null }>;
  now?: () => number;
}) {
  let state: ResendState = {
    target: null,
    ready: false,
    pending: false,
    remaining: 0,
    feedback: null,
    error: false,
  };
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<ResendState>) => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  };
  function tick() {
    const target = storage.read();
    const remaining = target ? Math.max(0, Math.ceil((target.retryAt - now()) / 1000)) : 0;
    if (!state.ready || remaining !== state.remaining || target?.email !== state.target?.email) {
      publish({ target, remaining, ready: true });
    }
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    tick,
    async submit() {
      tick();
      if (state.pending || state.remaining > 0) return;
      const target = storage.read();
      if (!target) {
        publish({
          feedback: "Return to signup to enter your email address before requesting another link.",
          error: true,
        });
        return;
      }
      // Set synchronously, before awaiting the provider, to reject duplicate clicks.
      publish({ pending: true, feedback: null, error: false });
      try {
        const { error } = await resend({
          type: "signup",
          email: target.email,
          options: { emailRedirectTo: target.redirectTo },
        });
        const limited =
          error?.status === 429 ||
          error?.code === "over_email_send_rate_limit" ||
          error?.code === "over_request_rate_limit";
        const current = storage.read();
        // Don't overwrite a corrected signup address if the page was left mid-request.
        if (
          current?.email !== target.email ||
          current?.redirectTo !== target.redirectTo ||
          current?.expiresAt !== target.expiresAt
        )
          return;
        if (!error || limited) {
          const updated = { ...current, retryAt: now() + RESEND_COOLDOWN_MS };
          storage.write(updated);
          publish({ target: updated, remaining: 60 });
        }
        publish({
          feedback: !error
            ? RESEND_SUCCESS
            : limited
              ? "Please wait a little longer before trying again."
              : "We couldn't request another link right now. Please try again later.",
          error: !!error,
        });
      } catch {
        // Never display/log provider messages, which may contain addresses or account details.
        publish({
          feedback: "We couldn't request another link right now. Please try again later.",
          error: true,
        });
      } finally {
        publish({ pending: false });
      }
    },
  };
}
