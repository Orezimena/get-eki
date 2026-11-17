import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/PasswordInput";
import { useAuth } from "@/lib/auth";
import { authDestination, authSearch } from "@/lib/auth-flow";
import { AuthStatus } from "@/components/AuthStatus";

export const Route = createFileRoute("/signin")({
  validateSearch: authSearch,
  head: () => ({
    meta: [
      { title: "Sign in — Eki" },
      {
        name: "description",
        content: "Sign in to Eki to read and write anonymous UK market reviews.",
      },
      { property: "og:title", content: "Sign in — Eki" },
      {
        property: "og:description",
        content: "Sign in to read and write anonymous UK market reviews.",
      },
    ],
  }),
  component: SignIn,
});

function SignIn() {
  const navigate = useNavigate();
  const { returnTo } = Route.useSearch();
  const { user, profile, loading, error: authError } = useAuth();
  useEffect(() => {
    if (!loading && !authError && user) {
      void navigate({ href: authDestination(profile, returnTo), replace: true });
    }
  }, [user, profile, loading, authError, returnTo, navigate]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setErrorMessage(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error)
        setErrorMessage(
          "Could not sign in. Check your email and password, and verify your email if needed.",
        );
      // AuthProvider resolves the session and profile before the effect routes.
    } catch {
      setErrorMessage("Could not sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function forgot() {
    if (!email) return toast.error("Enter your email first, then tap forgot password");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return toast.error(error.message);
    toast.success("Password reset link sent — check your inbox");
  }

  if (loading || authError || user) return <AuthStatus redirecting={!!user} />;

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="eki-panel p-8">
        <h1 className="text-2xl font-extrabold">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">Back to the good stalls.</p>

        <form
          onSubmit={submit}
          aria-busy={busy}
          aria-describedby={errorMessage ? "signin-error" : undefined}
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
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <button
                type="button"
                onClick={forgot}
                className="text-xs font-medium text-primary hover:underline"
              >
                Forgot password?
              </button>
            </div>
            <PasswordInput
              id="password"
              visibilityLabel="password"
              name="password"
              autoComplete="current-password"
              disabled={busy}
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrorMessage(null);
              }}
            />
          </div>
          {errorMessage && (
            <p id="signin-error" role="alert" className="text-sm text-destructive">
              {errorMessage}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-6 text-sm text-muted-foreground">
          New to Eki?{" "}
          <Link
            to="/signup"
            search={{ returnTo }}
            className="font-semibold text-primary hover:underline"
          >
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
