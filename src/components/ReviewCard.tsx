import { useState } from "react";
import { Flag, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { DIMENSIONS, FLAG_REASONS, formatDate, type Review } from "@/lib/eki";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const returnStyles: Record<string, string> = {
  Yes: "bg-mint text-mint-foreground border-transparent",
  Maybe: "bg-amber text-amber-foreground border-transparent",
  No: "bg-destructive text-destructive-foreground border-transparent",
};

export function ReviewCard({
  review,
  voted,
  onVoted,
}: {
  review: Review;
  voted: boolean;
  onVoted: () => void;
}) {
  const { user } = useAuth();
  const [count, setCount] = useState(review.helpful_count);
  const [hasVoted, setHasVoted] = useState(voted);
  const [busy, setBusy] = useState(false);

  async function upvote() {
    if (!user) return toast.error("Sign in to mark reviews as helpful");
    if (hasVoted || busy) return;
    setBusy(true);
    const { error } = await supabase
      .from("review_votes")
      .insert({ review_id: review.id, user_id: user.id });
    setBusy(false);
    if (error) return toast.error("Could not register your vote");
    setHasVoted(true);
    setCount((c) => c + 1);
    onVoted();
  }

  async function flag(reason: string) {
    if (!user) return toast.error("Sign in to flag a review");
    const { error } = await supabase
      .from("review_flags")
      .insert({ review_id: review.id, user_id: user.id, reason });
    if (error) return toast.error("You have already flagged this review");
    toast.success("Thanks — we'll take a look at this review");
  }

  return (
    <article className="eki-panel p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={cn("border", returnStyles[review.would_return])}>
          Would return: {review.would_return}
        </Badge>
        <Badge variant="outline">{review.product_category}</Badge>
        {review.trading_region && <Badge variant="outline">{review.trading_region}</Badge>}
        <span className="ml-auto text-xs text-muted-foreground">
          Traded {formatDate(review.trading_date)}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        {DIMENSIONS.map((d) => (
          <div key={d.key} className="flex items-center justify-between gap-2">
            <dt className="text-xs text-muted-foreground">{d.label}</dt>
            <dd className="text-sm font-semibold tabular-nums">{review[d.key]}/5</dd>
          </div>
        ))}
      </dl>

      {review.comment && <p className="mt-4 text-sm leading-relaxed">{review.comment}</p>}

      <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
        <Button
          variant={hasVoted ? "default" : "outline"}
          size="sm"
          onClick={upvote}
          disabled={hasVoted || busy}
        >
          <ThumbsUp size={14} className={cn(hasVoted && "fill-current")} />
          Helpful ({count})
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <Flag size={14} /> Flag
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Why are you flagging this?</DropdownMenuLabel>
            {FLAG_REASONS.map((r) => (
              <DropdownMenuItem key={r} onSelect={() => void flag(r)}>
                {r}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  );
}
