import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PRODUCT_CATEGORIES, REGIONS } from "@/lib/eki";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Account settings — Eki" },
      { name: "description", content: "Update your Eki product category and trading region." },
      { property: "og:title", content: "Account settings — Eki" },
      { property: "og:description", content: "Update your product category and trading region." },
    ],
  }),
  component: Account,
});

function Account() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const [category, setCategory] = useState("");
  const [region, setRegion] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCategory(profile?.product_category ?? "");
    setRegion(profile?.trading_region ?? "");
  }, [profile]);

  if (!loading && !user) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="eki-panel p-8">
          <h1 className="text-2xl font-extrabold">Sign in to view your account</h1>
          <Button className="mt-6" asChild>
            <Link to="/signin">Sign in</Link>
          </Button>
        </div>
      </div>
    );
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ product_category: category, trading_region: region })
      .eq("id", user!.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    await refreshProfile();
    toast.success("Account updated");
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-14">
      <h1 className="text-3xl font-extrabold">Account settings</h1>

      <form onSubmit={save} className="eki-panel mt-6 space-y-5 p-6">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={user?.email ?? ""} disabled />
        </div>

        <div className="space-y-1.5">
          <Label>Product category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Select a category" />
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
              <SelectValue placeholder="Select a region" />
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

        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </div>
  );
}
