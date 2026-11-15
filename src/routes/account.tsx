import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { TraderAccess } from "@/components/TraderAccess";
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
  component: AccountPage,
});

function AccountPage() {
  return (
    <TraderAccess returnTo="/account">
      <Account />
    </TraderAccess>
  );
}

function Account() {
  const { user, profile, loading, error: authError, saveProfile } = useAuth();
  const [category, setCategory] = useState("");
  const [region, setRegion] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCategory(profile?.product_category ?? "");
    setRegion(profile?.trading_region ?? "");
  }, [profile]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy || loading || authError || !user) return;
    setBusy(true);
    try {
      await saveProfile(category, region);
      toast.success("Account updated");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not save your profile.");
    } finally {
      setBusy(false);
    }
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
