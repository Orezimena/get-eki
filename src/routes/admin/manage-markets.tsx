import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AdminMarketAccess } from "@/components/AdminMarketAccess";
import { MarketForm } from "@/components/MarketForm";
import { Button } from "@/components/ui/button";
import { useMarkets } from "@/lib/queries";
import type { Market } from "@/lib/eki";

export const Route = createFileRoute("/admin/manage-markets")({
  head: () => ({
    meta: [{ title: "Manage Markets — Eki" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <AdminMarketAccess>
      <ManageMarkets />
    </AdminMarketAccess>
  ),
});
function ManageMarkets() {
  const markets = useMarkets();
  // Snapshot the chosen record so a background refetch cannot replace a draft.
  const [selected, setSelected] = useState<Market | null>(null);
  if (selected)
    return (
      <>
        <div className="mx-auto max-w-2xl px-4 pt-6">
          <Button variant="outline" onClick={() => setSelected(null)}>
            Back to market list
          </Button>
        </div>
        <MarketForm key={selected.id} market={selected} />
      </>
    );
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link to="/admin" className="text-primary underline">
        Back to admin
      </Link>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold">Manage Markets</h1>
        <Button asChild>
          <Link to="/admin/add-market">Add Market</Link>
        </Button>
      </div>
      {markets.isPending ? (
        <p role="status" className="mt-6">
          Loading markets…
        </p>
      ) : markets.isError ? (
        <div className="eki-panel mt-6 space-y-3 p-6">
          <p role="alert">Could not load markets. Please try again.</p>
          <Button disabled={markets.isFetching} onClick={() => void markets.refetch()}>
            Try again
          </Button>
        </div>
      ) : markets.data.length === 0 ? (
        <p className="mt-6">No markets yet.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {markets.data.map((market) => (
            <li
              key={market.id}
              className="eki-panel flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <div className="min-w-0">
                <h2 className="break-words font-bold">{market.name}</h2>
                <p className="break-words text-sm text-muted-foreground">
                  {market.location} · {market.city}
                </p>
              </div>
              <Button
                variant="outline"
                aria-label={`Edit ${market.name}`}
                onClick={() => setSelected(market)}
              >
                Edit
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
