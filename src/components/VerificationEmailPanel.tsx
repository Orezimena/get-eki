import { Link } from "@tanstack/react-router";
import { MailCheck } from "lucide-react";
import type { ResendState } from "@/lib/verification-email";
import { Button } from "@/components/ui/button";

export function VerificationEmailPanel({
  state,
  returnTo,
  onResend,
}: {
  state: ResendState;
  returnTo?: string;
  onResend: () => void;
}) {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <div className="eki-panel p-8">
        <MailCheck className="mx-auto text-primary" size={44} />
        <h1 className="mt-4 text-2xl font-extrabold">Check your email to verify your account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Check your inbox and spam folder
          {state.target ? (
            <>
              {" "}
              for <span className="break-all">{state.target.email}</span>
            </>
          ) : (
            ""
          )}
          . Use the verification link to continue to Eki and set up your trader profile.
        </p>
        <Button
          type="button"
          className="mt-6 h-auto min-h-10 w-full whitespace-normal py-2"
          disabled={!state.ready || !state.target || state.pending || state.remaining > 0}
          aria-describedby={state.remaining > 0 ? "resend-cooldown" : undefined}
          onClick={onResend}
        >
          {state.pending ? "Requesting another link…" : "Resend verification email"}
        </Button>
        {state.remaining > 0 && (
          <p id="resend-cooldown" className="mt-2 text-sm text-muted-foreground" aria-live="off">
            You can try again in {state.remaining} {state.remaining === 1 ? "second" : "seconds"}.
          </p>
        )}
        {state.feedback && (
          <p className="mt-3 text-sm" role={state.error ? "alert" : "status"}>
            {state.feedback}
          </p>
        )}
        {state.ready && !state.target && (
          <p className="mt-3 text-sm">
            Your signup email isn't available in this tab. Return to signup to enter your email
            address.
          </p>
        )}
        <p className="mt-4 text-sm text-muted-foreground">
          Wrong email address?{" "}
          <Link to="/signup" search={{ returnTo }} className="font-semibold text-primary underline">
            Return to signup
          </Link>
        </p>
        <Button variant="outline" className="mt-6" asChild>
          <Link to="/signin" search={{ returnTo }}>
            Back to sign in
          </Link>
        </Button>
      </div>
    </div>
  );
}
