import { createFileRoute, Link } from "@tanstack/react-router";
import { Info, MapPin } from "lucide-react";
import { useMemo } from "react";
import { MarketCard } from "@/components/MarketCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { computeStats, organiserSlug, sortReviews } from "@/lib/eki";
import { useApprovedReviews, useMarkets } from "@/lib/queries";

export const Route = createFileRoute("/organisers/$slug")({
  head: () => ({
    meta: [
      { title: "Market organiser profile — Eki" },
      {
        name: "description",
        content: "See every UK popup market run by this organiser and what traders say about them.",
      },
      { property: "og:title", content: "Market organiser profile — Eki" },
      { property: "og:description", content: "All markets run by this organiser on Eki." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrganiserProfile,
});

function OrganiserProfile() {
  const { slug } = Route.useParams();
  const { data: markets, isLoading } = useMarkets();
  const { data: reviews } = useApprovedReviews();

  const organiserMarkets = useMemo(
    () => (markets ?? []).filter((m) => m.organiser && organiserSlug(m.organiser) === slug),
    [markets, slug],
  );
  const name = organiserMarkets[0]?.organiser ?? null;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-10">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!name) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="font-medium">We couldn't find that organiser.</p>
        <Button className="mt-4" asChild>
          <Link to="/markets">Back to directory</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="eki-panel p-6 sm:p-8">
        <p className="text-xs font-semibold tracking-wide text-primary uppercase">Market organiser</p>
        <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">{name}</h1>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin size={15} /> {organiserMarkets.length} market
          {organiserMarkets.length === 1 ? "" : "s"} listed on Eki
        </p>

        <div className="mt-5 flex items-start gap-2.5 rounded-xl bg-mint p-4 text-mint-foreground">
          <Info size={18} className="mt-0.5 shrink-0" />
          <p className="text-sm font-medium">This organiser has not yet claimed their profile.</p>
        </div>

        <Button className="mt-5">Are you this organiser? Claim your profile</Button>
      </div>

      <section className="mt-8">
        <h2 className="text-2xl font-extrabold text-primary">Markets by {name}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {organiserMarkets.map((m) => (
            <MarketCard
              key={m.id}
              market={m}
              stats={computeStats(sortReviews((reviews ?? []).filter((r) => r.market_id === m.id)))}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
