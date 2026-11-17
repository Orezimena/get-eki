import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/PasswordInput";
import { PasswordFeedback, PasswordMatch } from "@/components/PasswordFeedback";
import { passwordFeedback, passwordRequestError } from "@/lib/password-feedback";
import { authSearch, safeReturnTo } from "@/lib/auth-flow";
import { pendingVerification, verificationRedirect } from "@/lib/verification-email";

export const Route = createFileRoute("/signup")({
  validateSearch: authSearch,
  head: () => ({
    meta: [
      { title: "Create your Eki account" },
      {
        name: "description",
        content: "Join Eki and review the UK markets you trade at, anonymously.",
      },
      { property: "og:title", content: "Create your Eki account" },
      { property: "og:description", content: "Join Eki and review the UK markets you trade at." },
    ],
  }),
  component: SignUp,
});

function SignUp() {
  const navigate = useNavigate();
  const { returnTo } = Route.useSearch();
  const destination = safeReturnTo(returnTo);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const feedback = passwordFeedback(password, confirm);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setErrorMessage(null);
    if (feedback.error) {
      setErrorMessage(feedback.error);
      return;
    }
    setBusy(true);
    try {
      const emailRedirectTo = verificationRedirect(window.location.origin, returnTo);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo },
      });
      if (error) {
        setErrorMessage(
          passwordRequestError(
            error,
            "We couldn't create your account. Please check your details and try again.",
          ),
        );
        return;
      }
      if (data.session) {
        pendingVerification.clear();
        return navigate({ to: "/onboarding", search: { returnTo: destination } });
      }
      pendingVerification.remember(email, emailRedirectTo);
      navigate({ to: "/verify-email", search: { returnTo: destination } });
    } catch {
      setErrorMessage("We couldn't create your account. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="eki-panel p-8">
        <h1 className="text-2xl font-extrabold">Create your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your reviews always stay anonymous to other traders.
        </p>

        <form
          onSubmit={submit}
          aria-busy={busy}
          aria-describedby={errorMessage ? "signup-error" : undefined}
          className="mt-6 space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              name="email"
              autoComplete="email"
              disabled={busy}
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrorMessage(null);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <PasswordInput
              id="password"
              visibilityLabel="password"
              name="password"
              autoComplete="new-password"
              disabled={busy}
              aria-describedby="signup-password-guidance"
              aria-invalid={password.length > 0 && !feedback.minimumMet}
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrorMessage(null);
              }}
            />
            <PasswordFeedback id="signup-password-guidance" password={password} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirm password</Label>
            <PasswordInput
              id="confirm"
              visibilityLabel="confirmation password"
              name="confirm-password"
              autoComplete="new-password"
              disabled={busy}
              aria-describedby="signup-password-match"
              aria-invalid={feedback.confirmationStarted && !feedback.confirmationMatches}
              required
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                setErrorMessage(null);
              }}
            />
          </div>
          <PasswordMatch id="signup-password-match" password={password} confirmation={confirm} />
          {errorMessage && (
            <p id="signup-error" role="alert" className="text-sm text-destructive">
              {errorMessage}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Creating account…" : "Create account"}
          </Button>
        </form>

        <p className="mt-6 text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            to="/signin"
            search={{ returnTo: destination }}
            className="font-semibold text-primary hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
