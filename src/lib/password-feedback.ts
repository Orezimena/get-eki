// Matches the existing signup/reset checks and the last manually verified
// Supabase minimum. Supabase remains authoritative for compromised passwords.
export const PASSWORD_MIN_LENGTH = 6;

export function passwordFeedback(password: string, confirmation: string) {
  const minimumMet = password.length >= PASSWORD_MIN_LENGTH;
  const confirmationStarted = confirmation.length > 0;
  const confirmationMatches = confirmationStarted && password === confirmation;
  return {
    minimumMet,
    confirmationStarted,
    confirmationMatches,
    error: !minimumMet
      ? `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`
      : password !== confirmation
        ? "Passwords do not match."
        : null,
  };
}

export function passwordRequestError(error: unknown, fallback: string): string {
  if (typeof error !== "object" || error === null || !("code" in error)) return fallback;
  if (error.code === "weak_password") {
    return "This password was rejected. Choose a longer, unique password that hasn't been exposed in a data breach.";
  }
  return fallback;
}
