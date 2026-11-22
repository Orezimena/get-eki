import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { AuthStatus } from "./AuthStatus";

export function AdminMarketAccess({ children }: { children: ReactNode }) {
  const { user, isAdmin, loading, error } = useAuth();
  if (loading || error) return <AuthStatus />;
  if (!user || !isAdmin)
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <h1 className="text-2xl font-bold">{user ? "Access denied" : "Admin sign in required"}</h1>
        <p className="mt-3">Only Eki administrators can manage markets.</p>
        <Link to="/admin" className="mt-4 inline-block text-primary underline">
          Return to admin
        </Link>
      </div>
    );
  return <div key={user.id}>{children}</div>;
}
