import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/PasswordInput";
import { Skeleton } from "@/components/ui/skeleton";
import { DIMENSIONS, formatDate } from "@/lib/eki";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useMarkets, usePendingReviews } from "@/lib/queries";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Moderation queue — Eki" },
      {
        name: "description",
        content: "Approve or reject pending trader reviews before they go live.",
      },
      { property: "og:title", content: "Moderation queue — Eki" },
      { property: "og:description", content: "Approve or reject pending trader reviews." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Admin,
});

function Admin() {
  const { user, isAdmin, loading } = useAuth();
  const queryClient = useQueryClient();
  const { data: markets } = useMarkets();
  const { data: pending, isLoading } = usePendingReviews(isAdmin);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <Skeleton className="h-32 rounded-xl" />
      </div>
    );
  }

  if (!user) return <AdminLogin />;

  if (!isAdmin) {
    return (
      <Gate title="Access denied">
        <p className="text-sm text-muted-foreground">
          Access denied. This area is for Eki admins only.
        </p>
      </Gate>
    );
  }

  async function decide(id: string, approve: boolean) {
    const { error } = approve
      ? await supabase.from("reviews").update({ status: "approved" }).eq("id", id)
      : await supabase.from("reviews").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(approve ? "Review approved" : "Review rejected");
    queryClient.invalidateQueries({ queryKey: ["reviews"] });
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-extrabold text-foreground">Moderation queue</h1>
      <p className="mt-1 text-muted-foreground">Pending reviews waiting to go live.</p>

      <div className="mt-6 space-y-4">
        {isLoading && <Skeleton className="h-32 rounded-xl" />}

        {!isLoading && (pending ?? []).length === 0 && (
          <div className="eki-panel p-10 text-center font-medium">
            Nothing pending — the queue is clear.
          </div>
        )}

        {(pending ?? []).map((r) => {
          const market = markets?.find((m) => m.id === r.market_id);
          const overall = DIMENSIONS.reduce((sum, d) => sum + r[d.key], 0) / DIMENSIONS.length;
          return (
            <article key={r.id} className="eki-panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-foreground">
                    {market?.name ?? "Unknown market"}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Traded {formatDate(r.trading_date)} · Submitted {formatDate(r.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="border-transparent bg-mint text-mint-foreground">
                    {r.product_category}
                  </Badge>
                  {r.trading_region && <Badge variant="outline">{r.trading_region}</Badge>}
                  <Badge className="border-transparent bg-secondary text-secondary-foreground">
                    {overall.toFixed(1)}/5
                  </Badge>
                </div>
              </div>

              {r.comment && (
                <p className="mt-3 line-clamp-3 text-sm leading-relaxed">{r.comment}</p>
              )}

              <div className="mt-4 flex gap-2 border-t border-border pt-3">
                <Button
                  size="sm"
                  className="bg-mint text-mint-foreground hover:bg-mint/85"
                  onClick={() => decide(r.id, true)}
                >
                  Approve
                </Button>
                <Button size="sm" variant="destructive" onClick={() => decide(r.id, false)}>
                  Reject
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setLoginError(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setLoginError("Access denied. This area is for Eki admins only.");
    } catch {
      setLoginError("Could not sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-20">
      <form
        onSubmit={submit}
        aria-busy={busy}
        aria-describedby={loginError ? "admin-login-error" : undefined}
        className="eki-panel space-y-4 p-8"
      >
        <h1 className="text-2xl font-extrabold text-foreground">Admin sign in</h1>
        <p className="text-sm text-muted-foreground">
          The moderation queue is restricted to Eki admins.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="admin-email">Email</Label>
          <Input
            id="admin-email"
            type="email"
            name="email"
            autoComplete="email"
            disabled={busy}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setLoginError(null);
            }}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="admin-password">Password</Label>
          <PasswordInput
            id="admin-password"
            visibilityLabel="admin password"
            name="password"
            autoComplete="current-password"
            disabled={busy}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setLoginError(null);
            }}
            required
          />
        </div>
        {loginError && (
          <p id="admin-login-error" role="alert" className="text-sm text-destructive">
            {loginError}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}

function Gate({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <div className="eki-panel space-y-4 p-8">
        <h1 className="text-2xl font-extrabold text-foreground">{title}</h1>
        {children}
      </div>
    </div>
  );
}
