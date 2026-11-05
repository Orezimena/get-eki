import { Link } from "@tanstack/react-router";
import { MarketCard } from "./MarketCard";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import type { Market, MarketStats } from "../lib/eki";

export function TopRatedMarkets({
  markets,
  isPending,
  isError,
}: {
  markets: { market: Market; stats: MarketStats }[];
  isPending: boolean;
  isError: boolean;
}) {
  if (isError) {
    return (
      <div className="eki-panel mt-6 p-8 text-center" role="alert">
        <p className="font-semibold">We couldn't load rated markets.</p>
        <p className="mt-2 text-sm text-muted-foreground">Please try refreshing the page.</p>
      </div>
    );
  }

  if (isPending) {
    return (
      <div
        className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        role="status"
        aria-label="Loading rated markets"
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-xl" />
        ))}
      </div>
    );
  }

  if (markets.length === 0) {
    return (
      <div className="eki-panel mt-6 p-8 text-center">
        <h3 className="text-xl font-extrabold">No rated markets yet</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Be among the first traders to share your experiences and help others find their next
          market.
        </p>
        <Button className="mt-5" asChild>
          <Link to="/markets">Explore markets</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {markets.map(({ market, stats }) => (
        <MarketCard key={market.id} market={market} stats={stats} />
      ))}
    </div>
  );
}
