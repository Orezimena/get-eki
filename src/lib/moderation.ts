import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type ReviewDecision = "approved" | "rejected";
export type DecisionResult =
  | { kind: "success"; status: ReviewDecision }
  | { kind: "ignored" }
  | { kind: "error"; message: string };

// One instance per review's action controls. The synchronous lock also protects
// against clicks arriving before React has rendered its disabled state.
export function createReviewDecision(client: Pick<SupabaseClient<Database>, "from">) {
  let pending = false;
  return {
    isPending: () => pending,
    async decide(id: string, status: ReviewDecision): Promise<DecisionResult> {
      if (pending) return { kind: "ignored" };
      pending = true;
      try {
        const { data, error } = await client
          .from("reviews")
          .update({ status })
          .eq("id", id)
          .eq("status", "pending")
          .select("id,status");
        if (error) {
          return {
            kind: "error",
            message: "We couldn't update this review. Refresh the queue and try again.",
          };
        }
        if (!data || data.length !== 1 || data[0].id !== id || data[0].status !== status) {
          // Zero rows can mean a concurrent decision, a missing row or filtered
          // permissions. None is proof that this request changed the review.
          return {
            kind: "error",
            message:
              "The decision could not be confirmed. Refresh the queue to check this review's current status.",
          };
        }
        return { kind: "success", status };
      } catch {
        // A lost response may follow a committed update. Don't claim failure to
        // persist or blindly retry; refresh before making another decision.
        return {
          kind: "error",
          message: "We couldn't confirm the decision. Refresh the queue before trying again.",
        };
      } finally {
        pending = false;
      }
    },
  };
}
