import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createReviewDecision, type ReviewDecision } from "@/lib/moderation";
import { Button } from "./ui/button";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "./ui/alert-dialog";

export function ReviewDecisionActions({
  reviewId,
  disabled = false,
  onSettled,
}: {
  reviewId: string;
  disabled?: boolean;
  onSettled: () => void;
}) {
  const [decision] = useState(() => createReviewDecision(supabase));
  const [busy, setBusy] = useState<ReviewDecision | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function decide(status: ReviewDecision) {
    if (disabled || decision.isPending()) return;
    setError(null);
    setBusy(status);
    const result = await decision.decide(reviewId, status);
    if (result.kind === "ignored") return;
    if (mounted.current) {
      setBusy(null);
      setRejectOpen(false);
      if (result.kind === "success") {
        toast.success(result.status === "approved" ? "Review approved" : "Review rejected");
      } else {
        setError(result.message);
        // Keep feedback visible if the refreshed queue removes this row.
        toast.error(result.message);
      }
    }
    // Refresh after uncertain responses too, and even if the account/page has
    // changed while the request was in flight. Do not optimistically remove rows.
    onSettled();
  }

  return (
    <div className="mt-4 space-y-3 border-t border-border pt-3" aria-busy={!!busy}>
      <div className="flex gap-2">
        <Button
          size="sm"
          className="bg-mint text-mint-foreground hover:bg-mint/85"
          disabled={disabled || !!busy}
          onClick={() => void decide("approved")}
        >
          {busy === "approved" ? "Approving…" : "Approve"}
        </Button>
        <AlertDialog
          open={rejectOpen}
          onOpenChange={(open) => {
            if (!decision.isPending()) setRejectOpen(open);
          }}
        >
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="destructive" disabled={disabled || !!busy}>
              Reject
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reject this review?</AlertDialogTitle>
              <AlertDialogDescription>
                The review will stay stored with a rejected status and will not appear in public
                review lists or ratings.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={!!busy}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={disabled || !!busy}
                onClick={(event) => {
                  event.preventDefault();
                  void decide("rejected");
                }}
              >
                {busy === "rejected" ? "Rejecting…" : "Confirm rejection"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      {busy && (
        <p role="status" className="text-sm">
          Updating review…
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
