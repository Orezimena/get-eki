import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/review-submitted")({
  head: () => ({
    meta: [
      { title: "Review submitted — Eki" },
      { name: "description", content: "Your market review has been submitted for checking." },
      { property: "og:title", content: "Review submitted — Eki" },
      { property: "og:description", content: "Your market review has been submitted for checking." },
    ],
  }),
  component: ReviewSubmitted,
});

function ReviewSubmitted() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <div className="eki-panel p-8">
        <CheckCircle2 className="mx-auto text-primary" size={48} />
        <h1 className="mt-4 text-2xl font-extrabold">Thanks for your review</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It'll go live once it's been checked — usually within 24 hours.
        </p>
        <Button className="mt-6" asChild>
          <Link to="/markets">Back to markets</Link>
        </Button>
      </div>
    </div>
  );
}
