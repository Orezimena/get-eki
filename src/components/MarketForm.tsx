import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { REGIONS, type Market } from "@/lib/eki";
import {
  createMarketCreator,
  marketDraftSchema,
  marketDraftFromRecord,
  marketEditSchema,
  marketSlug,
  type MarketDraft,
} from "@/lib/market-creation";
import { supabase } from "@/integrations/supabase/client";

export function MarketForm({ market }: { market?: Market }) {
  const queryClient = useQueryClient();
  const [create] = useState(() => createMarketCreator(supabase, market));
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [draft, setDraft] = useState<MarketDraft>(() =>
    market
      ? marketDraftFromRecord(market)
      : {
          name: "",
          city: "",
          location: "",
          region: "",
          type: "",
          slug: "",
          description: "",
          stall_fee_min: "",
          stall_fee_max: "",
        },
  );
  const [customSlug, setCustomSlug] = useState(!!market);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: number; slug: string } | null>(null);
  function change(field: keyof MarketDraft, value: string) {
    setDraft((old) => {
      const next = { ...old, [field]: value };
      if (!market && !customSlug && (field === "name" || field === "city"))
        next.slug = marketSlug(next.name, next.city);
      return next;
    });
    setErrors({});
    setFailure(null);
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busyRef.current || created) return;
    const parsed = (market ? marketEditSchema(market) : marketDraftSchema).safeParse({
      ...draft,
      categories_accepted: draft.categories_accepted?.filter((value) => value.trim()),
    });
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
        ),
      );
      setFailure("Please check the highlighted fields.");
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setFailure(null);
    setErrors({});
    try {
      const result = await create({
        ...draft,
        categories_accepted: draft.categories_accepted?.filter((value) => value.trim()),
      });
      // A refresh failure must not turn an already completed INSERT into a retry.
      void queryClient.invalidateQueries({ queryKey: ["markets"] }).catch(() => {});
      // My Reviews embeds market names in its response.
      void queryClient.invalidateQueries({ queryKey: ["reviews", "mine"] }).catch(() => {});
      if (mounted.current) setCreated(result);
    } catch (error) {
      if (mounted.current)
        setFailure(
          error instanceof Error
            ? error.message
            : "Could not confirm creation. Check the directory before trying again.",
        );
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function field(key: keyof MarketDraft, label: string, required = true) {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={key}>
          {label}
          {required ? " (required)" : " (optional)"}
        </Label>
        <Input
          id={key}
          name={key}
          value={String(draft[key] ?? "")}
          required={required}
          disabled={busy}
          readOnly={!!market && key === "slug"}
          maxLength={key === "location" ? 300 : key === "type" ? 80 : 160}
          aria-invalid={!!errors[key]}
          aria-describedby={errors[key] ? `${key}-error` : undefined}
          onChange={(event) => {
            if (key === "slug") setCustomSlug(true);
            change(key, event.target.value);
          }}
        />
        {errors[key] && (
          <p id={`${key}-error`} className="text-sm text-destructive">
            {errors[key]}
          </p>
        )}
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link to="/admin" className="text-primary underline">
        Back to admin
      </Link>
      <h1 className="mt-4 text-3xl font-extrabold">{market ? "Edit Market" : "Add Market"}</h1>
      {created ? (
        <div className="eki-panel mt-6 space-y-4 p-6">
          <p role="status">
            {market ? "Market updated successfully." : "Market created successfully."}
          </p>
          <Link
            to="/markets/$slug"
            params={{ slug: created.slug }}
            className="block text-primary underline"
          >
            View market
          </Link>
          <Link to="/markets" className="block text-primary underline">
            View market directory
          </Link>
        </div>
      ) : (
        <form
          onSubmit={submit}
          noValidate
          aria-busy={busy}
          className="eki-panel mt-6 space-y-5 p-6"
        >
          <p className="text-sm text-muted-foreground">
            {market
              ? "Changes become public immediately after saving. The market URL will stay unchanged."
              : "The listing becomes public immediately after saving."}
          </p>
          {field("name", "Market name")}
          <div className="grid gap-5 sm:grid-cols-2">
            {field("city", "City or town")}
            <div className="space-y-1.5">
              <Label htmlFor="region">Region (required)</Label>
              <select
                id="region"
                name="region"
                required
                disabled={busy}
                value={draft.region}
                onChange={(event) => change("region", event.target.value)}
                aria-invalid={!!errors.region}
                aria-describedby={errors.region ? "region-error" : undefined}
                className="h-10 w-full rounded-md border border-input bg-background px-3"
              >
                <option value="">Choose a region</option>
                {draft.region && !REGIONS.includes(draft.region) && (
                  <option value={draft.region}>{draft.region}</option>
                )}
                {REGIONS.map((region) => (
                  <option key={region}>{region}</option>
                ))}
              </select>
              {errors.region && (
                <p id="region-error" className="text-sm text-destructive">
                  {errors.region}
                </p>
              )}
            </div>
          </div>
          {field("location", "Venue or street address")}
          {field("type", "Market type")}
          <p className="text-sm text-muted-foreground">
            For example: Makers market, Food market or General market.
          </p>
          {field("organiser", "Organiser", false)}
          {field("frequency", "Frequency", false)}
          {field("hours", "Opening hours", false)}
          {field("typical_days", "Typical days", false)}
          {field("postcode", "Postcode", false)}
          <div className="space-y-1.5">
            <Label htmlFor="categories_accepted">
              Accepted categories (optional, one per line)
            </Label>
            <textarea
              id="categories_accepted"
              name="categories_accepted"
              className="min-h-24 w-full rounded-md border border-input bg-background p-3"
              disabled={busy}
              value={(draft.categories_accepted ?? []).join("\n")}
              onChange={(event) => {
                setDraft((old) => ({
                  ...old,
                  categories_accepted: event.target.value.split("\n"),
                }));
                setErrors({});
                setFailure(null);
              }}
              aria-invalid={!!errors.categories_accepted}
              aria-describedby={
                errors.categories_accepted ? "categories_accepted-error" : undefined
              }
            />
            {errors.categories_accepted && (
              <p id="categories_accepted-error" className="text-sm text-destructive">
                {errors.categories_accepted}
              </p>
            )}
          </div>
          {field("slug", "Market URL")}
          <p className="text-sm text-muted-foreground">
            {market
              ? "The existing URL is preserved so market links keep working."
              : "The final part of /markets/your-market-name. Change it if the suggested URL is already taken."}
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description (optional)</Label>
            <textarea
              id="description"
              name="description"
              maxLength={2000}
              disabled={busy}
              value={draft.description}
              onChange={(event) => change("description", event.target.value)}
              className="min-h-24 w-full rounded-md border border-input bg-background p-3"
              aria-invalid={!!errors.description}
              aria-describedby={errors.description ? "description-error" : undefined}
            />
            {errors.description && (
              <p id="description-error" className="text-sm text-destructive">
                {errors.description}
              </p>
            )}
          </div>
          <fieldset className="space-y-3">
            <legend className="font-semibold">Stall fees (optional)</legend>
            <p className="text-sm text-muted-foreground">
              Enter whole pounds, without pence. Leave both blank if unknown. Enter 0 only if the
              stall is confirmed free.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {(["stall_fee_min", "stall_fee_max"] as const).map((key, index) => (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={key}>{index === 0 ? "Minimum fee (£)" : "Maximum fee (£)"}</Label>
                  <Input
                    id={key}
                    name={key}
                    type="number"
                    min="0"
                    max="100000"
                    step="1"
                    value={String(draft[key] ?? "")}
                    disabled={busy}
                    onChange={(event) => change(key, event.target.value)}
                    aria-invalid={!!errors[key]}
                    aria-describedby={errors[key] ? `${key}-error` : undefined}
                  />
                  {errors[key] && (
                    <p id={`${key}-error`} className="text-sm text-destructive">
                      {errors[key]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </fieldset>
          {failure && (
            <p role="alert" className="text-sm text-destructive">
              {failure}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? "Saving market…" : market ? "Save changes" : "Create market"}
          </Button>
          {busy && (
            <p role="status" className="text-sm">
              Saving market…
            </p>
          )}
        </form>
      )}
    </div>
  );
}
