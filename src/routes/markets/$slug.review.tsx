import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { StarPicker } from "@/components/StarRating";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DIMENSIONS, PRODUCT_CATEGORIES, WOULD_RETURN, type DimensionKey } from "@/lib/eki";
import { useMarkets } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/markets/$slug/review")({
  head: () => ({
    meta: [
      { title: "Leave a review — Eki" },
      { name: "description", content: "Rate a UK popup market anonymously across five trading dimensions." },
      { property: "og:title", content: "Leave a review — Eki" },
      { property: "og:description", content: "Rate a UK popup market anonymously." },
    ],
  }),
  component: ReviewForm,
});

const today = new Date().toISOString().slice(0, 10);

function ReviewForm() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();
  const { data: markets } = useMarkets();
  const market = markets?.find((m) => m.slug === slug);

  const [scores, setScores] = useState<Record<DimensionKey, number>>({
    footfall_quality: 0,
    crowd_spend_power: 0,
    organiser_communication: 0,
    stall_fee_vs_return: 0,
    setup_logistics: 0,
  });
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("");
  const [wouldReturn, setWouldReturn] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (profile?.product_category) setCategory(profile.product_category);
  }, [profile]);

  if (!loading && !user) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="eki-panel p-8">
          <h1 className="text-2xl font-extrabold">Sign in to leave a review</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Reviews stay anonymous — we only need an account to keep them genuine.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button asChild>
              <Link to="/signin">Sign in</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/signup">Sign up</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!market) return;
    if (!date) return toast.error("Pick the date you traded");
    if (DIMENSIONS.some((d) => !scores[d.key])) return toast.error("Rate all five dimensions");
    if (!wouldReturn) return toast.error("Tell us whether you'd return");
    if (!category) return toast.error("Pick your product category");

    setBusy(true);
    const { error } = await supabase.from("reviews").insert({
      market_id: market.id,
      user_id: user!.id,
      trading_date: date,
      product_category: category,
      trading_region: profile?.trading_region ?? null,
      would_return: wouldReturn,
      comment: comment.trim() || null,
      status: "pending",
      ...scores,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/review-submitted" });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-extrabold">Leave a review</h1>
      <p className="mt-1 text-muted-foreground">
        Your review is published anonymously once it's been checked.
      </p>

      <form onSubmit={submit} className="eki-panel mt-6 space-y-6 p-6 sm:p-8">
        <div className="space-y-1.5">
          <Label htmlFor="market">Market</Label>
          <Input id="market" value={market?.name ?? ""} readOnly disabled />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="date">Date traded</Label>
            <Input
              id="date"
              type="date"
              max={today}
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
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
        </div>

        <div className="space-y-4 border-t border-border pt-6">
          {DIMENSIONS.map((d) => (
            <div key={d.key} className="flex flex-wrap items-center justify-between gap-2">
              <Label>{d.label}</Label>
              <StarPicker
                name={d.label}
                value={scores[d.key]}
                onChange={(v) => setScores((p) => ({ ...p, [d.key]: v }))}
              />
            </div>
          ))}
        </div>

        <div className="space-y-2 border-t border-border pt-6">
          <Label>Would you return?</Label>
          <div className="flex gap-2">
            {WOULD_RETURN.map((w) => (
              <button
                key={w}
                type="button"
                aria-pressed={wouldReturn === w}
                onClick={() => setWouldReturn(w)}
                className={cn(
                  "flex-1 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors",
                  wouldReturn === w
                    ? "border-mint bg-mint text-mint-foreground"
                    : "border-border hover:border-mint",
                )}
              >
                {w}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="comment">Comment (optional)</Label>
          <Textarea
            id="comment"
            rows={5}
            maxLength={500}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What should other traders know before they book?"
          />
          <p className="text-right text-xs text-muted-foreground">{comment.length}/500</p>
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "Submitting…" : "Submit review"}
        </Button>
      </form>
    </div>
  );
}
