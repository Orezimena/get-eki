import { PASSWORD_MIN_LENGTH, passwordFeedback } from "@/lib/password-feedback";

export function PasswordFeedback({ id, password }: { id: string; password: string }) {
  const { minimumMet } = passwordFeedback(password, "");
  return (
    <div id={id} className="space-y-1 text-sm text-muted-foreground">
      <p>At least {PASSWORD_MIN_LENGTH} characters.</p>
      <p role="status" aria-live="polite">
        {!password
          ? "Enter a password to check its length."
          : minimumMet
            ? "Minimum length met. Length alone does not guarantee strength."
            : "Minimum length not yet met."}
      </p>
      <p>
        For better strength, use a longer, unique passphrase. Compromised passwords are checked when
        you submit.
      </p>
    </div>
  );
}

export function PasswordMatch({
  id,
  password,
  confirmation,
}: {
  id: string;
  password: string;
  confirmation: string;
}) {
  const feedback = passwordFeedback(password, confirmation);
  return (
    <p id={id} className="text-sm text-muted-foreground" role="status" aria-live="polite">
      {feedback.confirmationStarted
        ? feedback.confirmationMatches
          ? "Passwords match."
          : "Passwords do not match."
        : "Re-enter your password to confirm it."}
    </p>
  );
}
