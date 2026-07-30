import { Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { StarRating } from "./StarRating";
import { feeRange, type Market, type MarketStats } from "@/lib/eki";
import { Badge } from "@/components/ui/badge";

export function MarketCard({ market, stats }: { market: Market; stats: MarketStats }) {
  return (
    <Link
      to="/markets/$slug"
      params={{ slug: market.slug }}
      className="eki-panel group flex flex-col gap-3 p-5 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg leading-snug font-bold text-foreground group-hover:text-primary">{market.name}</h3>
        <Badge className="shrink-0 border-transparent bg-mint text-mint-foreground">
          {market.type}
        </Badge>
      </div>

      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <MapPin size={14} /> {market.city} · {market.region}
      </p>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <span className="text-sm font-semibold">
          {feeRange(market)} <span className="font-normal text-muted-foreground">stall</span>
        </span>
        {stats.rated ? (
          <span className="flex items-center gap-2">
            <StarRating value={stats.overall ?? 0} />
            <span className="text-sm font-semibold text-foreground">{stats.overall?.toFixed(1)}</span>
            <span className="text-xs text-muted-foreground">({stats.reviewCount})</span>
          </span>
        ) : (
          <span className="rounded-full bg-neutral-badge px-2.5 py-1 text-xs font-medium text-neutral-badge-foreground">
            Not yet rated
          </span>
        )}
      </div>
    </Link>
  );
}
