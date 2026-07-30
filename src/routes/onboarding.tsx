import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
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
  head: () => ({
    meta: [
      { title: "Set up your trader profile — Eki" },
      { name: "description", content: "Tell us what you sell and where you trade to personalise Eki." },
      { property: "og:title", content: "Set up your trader profile — Eki" },
      { property: "og:description", content: "Tell us what you sell and where you trade." },
    ],
  }),
  component: Onboarding,
});

function Onboarding() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [category, setCategory] = useState("");
  const [region, setRegion] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (profile) {
      setCategory(profile.product_category ?? "");
      setRegion(profile.trading_region ?? "");
    }
  }, [profile]);

  if (!loading && !user) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="eki-panel p-8">
          <h1 className="text-2xl font-extrabold">Sign in to finish setup</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Verify your email, then sign in to set your product category and trading region.
          </p>
          <Button className="mt-6" asChild>
            <Link to="/signin">Sign in</Link>
          </Button>
        </div>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!category || !region) return toast.error("Pick a product category and a trading region");
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ product_category: category, trading_region: region, onboarded: true })
      .eq("id", user!.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    await refreshProfile();
    toast.success("Profile saved");
    navigate({ to: "/markets" });
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

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Saving…" : "Finish setup"}
          </Button>
        </form>
      </div>
    </div>
  );
}
