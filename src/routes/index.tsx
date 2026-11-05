import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, EyeOff, ShieldCheck, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { TopRatedMarkets } from "@/components/TopRatedMarkets";
import { Button } from "@/components/ui/button";
import { computeStats } from "@/lib/eki";
import { useApprovedReviews, useMarkets } from "@/lib/queries";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Eki |Trusted reviews for popup markets in UK" },
      {
        name: "description",
        content:
          "For market traders who mean business. Anonymous reviews of UK popup markets, written by the traders who trade there",
      },
      { property: "og:title", content: "Eki |Trusted reviews for popup markets in UK" },
      {
        property: "og:description",
        content:
          "For market traders who mean business. Anonymous reviews of UK popup markets, written by the traders who trade there",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const marketsQuery = useMarkets();
  const reviewsQuery = useApprovedReviews();
  const { data: markets } = marketsQuery;
  const { data: reviews } = reviewsQuery;

  const top = useMemo(() => {
    if (!markets || !reviews) return [];
    return markets
      .map((m) => ({ market: m, stats: computeStats(reviews.filter((r) => r.market_id === m.id)) }))
      .filter((x) => x.stats.rated)
      .sort((a, b) => (b.stats.overall ?? 0) - (a.stats.overall ?? 0))
      .slice(0, 6);
  }, [markets, reviews]);

  return (
    <>
      <section className="eki-hero">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:py-28">
          <p className="text-sm font-semibold tracking-widest uppercase opacity-90">
            Anonymous market intelligence
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-extrabold sm:text-6xl">
            For market traders who mean business
          </h1>
          <p className="mt-5 max-w-xl text-lg opacity-95">
            Find out what a pitch is really like before you pay for it. Honest, anonymous reviews
            from the traders who've already stood there.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" variant="secondary" asChild>
              <Link to="/signup">Sign up free</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              asChild
            >
              <Link to="/signin">Sign in</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: EyeOff,
              title: "Fully anonymous",
              body: "Reviews never show trader names or businesses.",
            },
            {
              icon: TrendingUp,
              title: "Five real dimensions",
              body: "Footfall, spend power, comms, fees and logistics.",
            },
            {
              icon: ShieldCheck,
              title: "Approved trader reviews",
              body: "Every approved review counts, starting with the first.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="eki-panel p-5">
              <Icon className="text-primary" />
              <h2 className="mt-3 font-bold">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold sm:text-3xl">Top rated markets</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Markets with approved reviews, best score first.
            </p>
          </div>
          <Button variant="ghost" asChild>
            <Link to="/markets">
              All markets <ArrowRight size={16} />
            </Link>
          </Button>
        </div>

        <TopRatedMarkets
          markets={top}
          isPending={marketsQuery.isPending || reviewsQuery.isPending}
          isError={marketsQuery.isError || reviewsQuery.isError}
        />
      </section>
    </>
  );
}
