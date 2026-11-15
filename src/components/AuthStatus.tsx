import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export function AuthStatus({ redirecting = false }: { redirecting?: boolean }) {
  const { error, retry } = useAuth();
  return (
    <div className="mx-auto max-w-md px-4 py-16" aria-live="polite">
      {error ? (
        <div role="alert" className="eki-panel space-y-4 p-8">
          <p>{error}</p>
          <Button onClick={() => void retry()}>Try again</Button>
        </div>
      ) : (
        <p role="status">
          {redirecting ? "Taking you to the next step…" : "Loading your account…"}
        </p>
      )}
    </div>
  );
}
