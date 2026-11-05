import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { CalendarDays, MapPin, PoundSterling, User } from "lucide-react";
import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ReviewCard } from "@/components/ReviewCard";
import { StarRating } from "@/components/StarRating";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { computeStats, DIMENSIONS, feeRange, organiserSlug, sortReviews } from "@/lib/eki";
import { useApprovedReviews, useMarkets, useMyVotes } from "@/lib/queries";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/markets/$slug/")({
  head: () => ({
    meta: [
      { title: "Market profile — Eki" },
      {
        name: "description",
        content: "Trader ratings for footfall, spend power, organiser comms, fees and logistics.",
      },
      { property: "og:title", content: "Market profile — Eki" },
      { property: "og:description", content: "Trader-sourced ratings for this UK popup market." },
    ],
  }),
  component: MarketProfile,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-md px-4 py-20 text-center" role="alert">
      <p className="font-medium">
        {error instanceof Error ? error.message : "Something went wrong"}
      </p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <p className="font-medium">We couldn't find that market.</p>
      <Button className="mt-4" asChild>
        <Link to="/markets">Back to directory</Link>
      </Button>
    </div>
  ),
});

function MarketProfile() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const { data: markets, isLoading } = useMarkets();
  const { data: reviews } = useApprovedReviews();
  const { data: votes } = useMyVotes(user?.id);
  const queryClient = useQueryClient();

  const market = markets?.find((m) => m.slug === slug);
  const marketReviews = useMemo(
    () => (market && reviews ? sortReviews(reviews.filter((r) => r.market_id === market.id)) : []),
    [market, reviews],
  );
  const stats = computeStats(marketReviews);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-10">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!market) throw notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="eki-panel p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge className="border-transparent bg-secondary text-secondary-foreground">
              {market.type}
            </Badge>
            <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">{market.name}</h1>
            <p className="mt-2 flex items-center gap-1.5 text-muted-foreground">
              <MapPin size={16} /> {market.location}, {market.city} · {market.region}
            </p>
          </div>
          <Button asChild>
            <Link to="/markets/$slug/review" params={{ slug: market.slug }}>
              Leave a review
            </Link>
          </Button>
        </div>

        <dl className="mt-6 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays size={14} /> Frequency
            </dt>
            <dd className="mt-0.5 font-semibold">{market.frequency ?? "—"}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <User size={14} /> Organiser
            </dt>
            <dd className="mt-0.5 font-semibold">
              {market.organiser ? (
                <Link
                  to="/organisers/$slug"
                  params={{ slug: organiserSlug(market.organiser) }}
                  className="text-mint-foreground underline decoration-mint decoration-2 underline-offset-4 hover:text-primary"
                >
                  {market.organiser}
                </Link>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <PoundSterling size={14} /> Stall fee
            </dt>
            <dd className="mt-0.5 font-semibold">{feeRange(market)}</dd>
          </div>
        </dl>

        {market.description && <p className="mt-6 leading-relaxed">{market.description}</p>}

        {market.categories_accepted?.length > 0 && (
          <div className="mt-5">
            <p className="text-xs text-muted-foreground">Categories accepted</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {market.categories_accepted.map((c) => (
                <Badge key={c} className="border-transparent bg-mint text-mint-foreground">
                  {c}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {stats.rated ? (
        <>
          <section className="eki-panel mt-6 p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-5xl font-extrabold text-foreground">
                {stats.overall?.toFixed(1)}
              </span>
              <div>
                <StarRating value={stats.overall ?? 0} size={20} />
                <p className="mt-1 text-sm text-foreground">
                  Based on {stats.reviewCount} {stats.reviewCount === 1 ? "review" : "reviews"}
                </p>
              </div>
              <div className="ml-auto rounded-xl bg-mint px-4 py-3 text-center text-mint-foreground">
                <p className="text-2xl font-extrabold">{stats.wouldReturnPct}%</p>
                <p className="text-xs font-medium">would return</p>
                <p className="text-xs">
                  Based on {stats.reviewCount} {stats.reviewCount === 1 ? "review" : "reviews"}
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {DIMENSIONS.map((d) => {
                const v = stats.dimensions![d.key];
                return (
                  <div key={d.key}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{d.label}</span>
                      <span className="font-semibold tabular-nums">{v.toFixed(1)}</span>
                    </div>
                    <Progress value={(v / 5) * 100} className="mt-1.5 h-2" />
                  </div>
                );
              })}
            </div>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-2xl font-extrabold text-foreground">Trader reviews</h2>
            {marketReviews.map((r) => (
              <ReviewCard
                key={r.id}
                review={r}
                voted={(votes ?? []).includes(r.id)}
                onVoted={() => {
                  void queryClient.invalidateQueries({ queryKey: ["review_votes", user?.id] });
                  void queryClient.invalidateQueries({ queryKey: ["reviews", "approved"] });
                }}
              />
            ))}
          </section>
        </>
      ) : (
        <div className="mt-6 rounded-xl border border-border border-l-4 border-l-mint bg-mint-soft p-10 text-center text-foreground">
          <p className="font-medium">No reviews yet — be the first to review this market</p>
          <Button className="mt-4" asChild>
            <Link to="/markets/$slug/review" params={{ slug: market.slug }}>
              Leave a review
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
