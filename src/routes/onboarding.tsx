import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { authSearch, isProfileComplete, safeReturnTo } from "@/lib/auth-flow";
import { AuthStatus } from "@/components/AuthStatus";
import { PRODUCT_CATEGORIES, REGIONS } from "@/lib/eki";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/onboarding")({
  validateSearch: authSearch,
  head: () => ({
    meta: [
      { title: "Set up your trader profile — Eki" },
      {
        name: "description",
        content: "Tell us what you sell and where you trade to personalise Eki.",
      },
      { property: "og:title", content: "Set up your trader profile — Eki" },
      { property: "og:description", content: "Tell us what you sell and where you trade." },
    ],
  }),
  component: Onboarding,
});

function Onboarding() {
  const { user, profile, loading, error } = useAuth();
  const { returnTo } = Route.useSearch();
  const navigate = useNavigate();
  const destination = safeReturnTo(returnTo);

  useEffect(() => {
    if (!loading && !error && user && isProfileComplete(profile)) {
      void navigate({ href: destination, replace: true });
    }
  }, [loading, error, user, profile, destination, navigate]);

  if (loading || error) return <AuthStatus />;
  if (user && isProfileComplete(profile)) return <AuthStatus redirecting />;

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="eki-panel p-8">
          <h1 className="text-2xl font-extrabold">Sign in to finish setup</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Verify your email, then sign in to set your product category and trading region.
          </p>
          <Button className="mt-6" asChild>
            <Link to="/signin" search={{ returnTo: destination }}>
              Sign in
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return <OnboardingForm key={user.id} />;
}

function OnboardingForm() {
  const { user, profile, loading, error, saveProfile, retry } = useAuth();
  const [category, setCategory] = useState("");
  const [region, setRegion] = useState("");
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setCategory(profile?.product_category ?? "");
    setRegion(profile?.trading_region ?? "");
    setSaveError(null);
  }, [profile]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || loading || error || !user) return;
    if (!PRODUCT_CATEGORIES.includes(category) || !REGIONS.includes(region)) {
      setSaveError("Pick a product category and a trading region.");
      return;
    }
    setBusy(true);
    setSaveError(null);
    try {
      await saveProfile(category, region);
      // The completion effect routes only after the returned row is verified.
    } catch (cause) {
      setSaveError(
        cause instanceof Error ? cause.message : "We couldn't save your profile. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="eki-panel p-8">
        <h1 className="text-2xl font-extrabold">Tell us about your stall</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          We use this to pre-fill your reviews. It's never shown next to your name.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-5">
          <div className="space-y-1.5">
            <Label>Product category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="What do you sell?" />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Trading region</Label>
            <Select value={region} onValueChange={setRegion}>
              <SelectTrigger>
                <SelectValue placeholder="Where do you mostly trade?" />
              </SelectTrigger>
              <SelectContent>
                {REGIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {saveError && (
            <div role="alert" className="space-y-2">
              <p className="text-sm text-destructive">{saveError}</p>
              <Button type="button" variant="outline" onClick={() => void retry()}>
                Reload profile
              </Button>
            </div>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Saving…" : "Finish setup"}
          </Button>
        </form>
      </div>
    </div>
  );
}
