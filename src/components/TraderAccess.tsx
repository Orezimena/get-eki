import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { authDestination, isProfileComplete, safeReturnTo } from "@/lib/auth-flow";
import { AuthStatus } from "./AuthStatus";
import { Button } from "./ui/button";

// This gate applies only to trader actions, never public market browsing.
export function TraderAccess({ returnTo, children }: { returnTo: string; children: ReactNode }) {
  const { user, profile, loading, error } = useAuth();
  const navigate = useNavigate();
  const complete = isProfileComplete(profile);
  const destination = safeReturnTo(returnTo);
  useEffect(() => {
    if (!loading && !error && user && !complete) {
      void navigate({ href: authDestination(profile, destination), replace: true });
    }
  }, [loading, error, user, complete, profile, destination, navigate]);

  if (loading || error) return <AuthStatus />;
  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="eki-panel p-8">
          <h1 className="text-2xl font-extrabold">
            {destination === "/account"
              ? "Sign in to view your account"
              : "Sign in to leave a review"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Reviews stay anonymous — we only need an account to keep them genuine.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button asChild>
              <Link to="/signin" search={{ returnTo: destination }}>
                Sign in
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/signup" search={{ returnTo: destination }}>
                Sign up
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }
  if (!complete) return <AuthStatus redirecting />;
  // Account changes remount protected forms rather than retaining the prior draft.
  return <div key={user.id}>{children}</div>;
}
