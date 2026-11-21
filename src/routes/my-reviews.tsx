import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TraderAccess } from "@/components/TraderAccess";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { DIMENSIONS } from "@/lib/eki";
import { myReviewsQuery } from "@/lib/my-reviews";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/my-reviews")({
  head: () => ({ meta: [{ title: "My Reviews — Eki" }, { name: "robots", content: "noindex" }] }),
  component: MyReviewsPage,
});

function MyReviewsPage() {
  return (
    <TraderAccess returnTo="/my-reviews" requireProfile={false}>
      <MyReviews />
    </TraderAccess>
  );
}

const statusLabels: Record<string, string> = {
  pending: "Pending",
  approved: "Published",
  rejected: "Rejected",
};
const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/London",
});

function MyReviews() {
  const { user } = useAuth();
  // Mounted only after authentication is ready; identity changes remount this
  // component. No placeholder data can carry another account's history over.
  const reviews = useQuery(myReviewsQuery(supabase, user!.id));
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-extrabold">My Reviews</h1>
      <p className="mt-2 text-muted-foreground">Your submissions and their moderation status.</p>
      {reviews.isPending ? (
        <p className="mt-6" role="status">
          Loading your reviews…
        </p>
      ) : reviews.isError ? (
        <div className="eki-panel mt-6 p-6">
          <p role="alert">We couldn’t load your reviews. Please try again.</p>
          <Button
            className="mt-4"
            onClick={() => void reviews.refetch()}
            disabled={reviews.isFetching}
          >
            {reviews.isFetching ? "Trying again…" : "Try again"}
          </Button>
        </div>
      ) : reviews.data.length === 0 ? (
        <div className="eki-panel mt-6 p-6">
          <p>You haven’t submitted any reviews yet.</p>
          <Link to="/markets" className="mt-3 inline-block text-primary underline">
            Browse markets
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-5" aria-label="Your submitted reviews">
          {reviews.data.map((review) => {
            const rating =
              DIMENSIONS.reduce((sum, dimension) => sum + review[dimension.key], 0) /
              DIMENSIONS.length;
            return (
              <li key={review.id} className="eki-panel min-w-0 p-5 sm:p-6">
                <article>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h2 className="break-words text-xl font-bold">
                      {review.markets ? (
                        <Link
                          to="/markets/$slug"
                          params={{ slug: review.markets.slug }}
                          className="text-primary underline"
                        >
                          {review.markets.name}
                        </Link>
                      ) : (
                        "Market unavailable"
                      )}
                    </h2>
                    <span className="rounded-full bg-muted px-3 py-1 text-sm font-semibold">
                      {statusLabels[review.status] ?? "Status unavailable"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Submitted{" "}
                    <time dateTime={review.created_at}>
                      {dateFormat.format(new Date(review.created_at))}
                    </time>
                  </p>
                  <p className="mt-3 font-semibold">Overall rating: {rating.toFixed(1)} out of 5</p>
                  <p className="mt-3 whitespace-pre-wrap break-words">
                    {review.comment || "No written review provided."}
                  </p>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
