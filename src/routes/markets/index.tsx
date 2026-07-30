import { createFileRoute } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { MarketCard } from "@/components/MarketCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { computeStats, gbp, REGIONS } from "@/lib/eki";
import { useApprovedReviews, useMarkets } from "@/lib/queries";

export const Route = createFileRoute("/markets/")({
  head: () => ({
    meta: [
      { title: "UK market directory — Eki" },
      {
        name: "description",
        content:
          "Browse UK popup markets with trader-sourced ratings for footfall, spend power, organiser comms and stall fees.",
      },
      { property: "og:title", content: "UK market directory — Eki" },
      { property: "og:description", content: "Browse UK popup markets rated by the traders who work them." },
    ],
  }),
  component: MarketsPage,
});

const FEE_MAX = 100;
const ANY = "any";

function MarketsPage() {
  const { data: markets, isLoading } = useMarkets();
  const { data: reviews } = useApprovedReviews();

  const [search, setSearch] = useState("");
  const [types, setTypes] = useState<string[]>([]);
  const [region, setRegion] = useState(ANY);
  const [fee, setFee] = useState<number[]>([FEE_MAX]);
  const [minScore, setMinScore] = useState(ANY);
  const [ratedOnly, setRatedOnly] = useState(false);

  const marketTypes = useMemo(
    () => Array.from(new Set((markets ?? []).map((m) => m.type))).sort(),
    [markets],
  );

  const rows = useMemo(() => {
    if (!markets || !reviews) return [];
    return markets.map((m) => ({
      market: m,
      stats: computeStats(reviews.filter((r) => r.market_id === m.id)),
    }));
  }, [markets, reviews]);

  const q = search.trim().toLowerCase();
  const searched = rows.filter(
    ({ market }) =>
      !q || market.name.toLowerCase().includes(q) || market.city.toLowerCase().includes(q),
  );

  const filtered = searched.filter(({ market, stats }) => {
    if (types.length && !types.includes(market.type)) return false;
    if (region !== ANY && market.region !== region) return false;
    if (market.stall_fee_min > fee[0]) return false;
    if (ratedOnly && !stats.rated) return false;
    if (minScore !== ANY && (!stats.rated || (stats.overall ?? 0) < Number(minScore))) return false;
    return true;
  });

  const filtersActive =
    types.length > 0 || region !== ANY || fee[0] < FEE_MAX || minScore !== ANY || ratedOnly;

  function clearFilters() {
    setTypes([]);
    setRegion(ANY);
    setFee([FEE_MAX]);
    setMinScore(ANY);
    setRatedOnly(false);
  }

  const pills: { label: string; clear: () => void }[] = [
    ...types.map((t) => ({ label: t, clear: () => setTypes((p) => p.filter((x) => x !== t)) })),
    ...(region !== ANY ? [{ label: region, clear: () => setRegion(ANY) }] : []),
    ...(fee[0] < FEE_MAX ? [{ label: `Up to ${gbp(fee[0])}`, clear: () => setFee([FEE_MAX]) }] : []),
    ...(minScore !== ANY ? [{ label: `${minScore}+ score`, clear: () => setMinScore(ANY) }] : []),
    ...(ratedOnly ? [{ label: "Rated only", clear: () => setRatedOnly(false) }] : []),
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-extrabold sm:text-4xl">Market directory</h1>
      <p className="mt-1 text-muted-foreground">
        {markets?.length ?? 0} UK popup markets, rated by traders.
      </p>

      <div className="relative mt-6">
        <Search className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" size={18} />
        <Input
          className="h-12 pl-10"
          placeholder="Search by market name or city…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search markets"
        />
      </div>

      <div className="eki-panel mt-4 grid gap-5 p-5 lg:grid-cols-4">
        <div className="space-y-2">
          <Label>Market type</Label>
          <div className="flex flex-wrap gap-1.5">
            {marketTypes.map((t) => {
              const on = types.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setTypes((p) => (on ? p.filter((x) => x !== t) : [...p, t]))
                  }
                  className={
                    on
                      ? "rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
                      : "rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary"
                  }
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Region</Label>
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>All regions</SelectItem>
              {REGIONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Max stall fee: {fee[0] >= FEE_MAX ? "Any" : gbp(fee[0])}</Label>
          <Slider min={10} max={FEE_MAX} step={5} value={fee} onValueChange={setFee} />
        </div>

        <div className="space-y-2">
          <Label>Minimum score</Label>
          <Select value={minScore} onValueChange={setMinScore}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any score</SelectItem>
              {["3", "3.5", "4", "4.5"].map((s) => (
                <SelectItem key={s} value={s}>
                  {s}+
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 pt-1">
            <Switch id="rated" checked={ratedOnly} onCheckedChange={setRatedOnly} />
            <Label htmlFor="rated" className="text-sm font-normal">
              Only show rated markets
            </Label>
          </div>
        </div>
      </div>

      {pills.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {pills.map((p) => (
            <Badge key={p.label} variant="secondary" className="gap-1 py-1 pr-1 pl-3">
              {p.label}
              <button
                type="button"
                onClick={p.clear}
                aria-label={`Remove ${p.label} filter`}
                className="rounded-full p-0.5 hover:bg-background"
              >
                <X size={13} />
              </button>
            </Badge>
          ))}
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear all
          </Button>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)
          : filtered.map(({ market, stats }) => (
              <MarketCard key={market.id} market={market} stats={stats} />
            ))}
      </div>

      {!isLoading && filtered.length === 0 && (
        <div className="eki-panel mt-6 p-10 text-center">
          {searched.length === 0 ? (
            <p className="font-medium">No markets found. Try a different search or clear your filters</p>
          ) : (
            <>
              <p className="font-medium">No markets match your filters</p>
              <Button className="mt-4" onClick={clearFilters} variant="outline">
                Clear filters
              </Button>
            </>
          )}
          {searched.length === 0 && filtersActive && (
            <Button className="mt-4" onClick={clearFilters} variant="outline">
              Clear filters
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
