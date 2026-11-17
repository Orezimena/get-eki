import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/PasswordInput";
import { PasswordFeedback, PasswordMatch } from "@/components/PasswordFeedback";
import { passwordFeedback, passwordRequestError } from "@/lib/password-feedback";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — Eki" },
      { name: "description", content: "Choose a new password for your Eki trader account." },
      { property: "og:title", content: "Set a new password — Eki" },
      { property: "og:description", content: "Choose a new password for your Eki account." },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
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
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setErrorMessage(
          passwordRequestError(
            error,
            "We couldn't update your password. Try again or request a new reset link.",
          ),
        );
        return;
      }
      toast.success("Password updated");
      navigate({ to: "/markets" });
    } catch {
      setErrorMessage("We couldn't update your password. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="eki-panel p-8">
        <h1 className="text-2xl font-extrabold">Set a new password</h1>
        <form
          onSubmit={submit}
          aria-busy={busy}
          aria-describedby={errorMessage ? "reset-error" : undefined}
          className="mt-6 space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="password">New password</Label>
            <PasswordInput
              id="password"
              visibilityLabel="new password"
              name="password"
              autoComplete="new-password"
              disabled={busy}
              aria-describedby="reset-password-guidance"
              aria-invalid={password.length > 0 && !feedback.minimumMet}
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrorMessage(null);
              }}
            />
            <PasswordFeedback id="reset-password-guidance" password={password} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirm new password</Label>
            <PasswordInput
              id="confirm"
              visibilityLabel="confirmation password"
              name="confirm-password"
              autoComplete="new-password"
              disabled={busy}
              aria-describedby="reset-password-match"
              aria-invalid={feedback.confirmationStarted && !feedback.confirmationMatches}
              required
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                setErrorMessage(null);
              }}
            />
          </div>
          <PasswordMatch id="reset-password-match" password={password} confirmation={confirm} />
          {errorMessage && (
            <p id="reset-error" role="alert" className="text-sm text-destructive">
              {errorMessage}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Saving…" : "Update password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
