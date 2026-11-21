import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// RLS must independently enforce owner/admin access. This filter is not an
// authorisation boundary; public review visibility is handled separately.
export function myReviewsQuery(client: Pick<SupabaseClient<Database>, "from">, userId: string) {
  return {
    queryKey: ["reviews", "mine", userId] as const,
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      if (!userId) throw new Error("Sign in to view your reviews.");
      const { data, error } = await client
        .from("reviews")
        .select(
          "id,created_at,status,comment,footfall_quality,crowd_spend_power,organiser_communication,stall_fee_vs_return,setup_logistics,markets(name,slug)",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .abortSignal(signal);
      if (error) throw error;
      if (!data) throw new Error("No review response received.");
      return data;
    },
  };
}

export type MyReview = Awaited<ReturnType<ReturnType<typeof myReviewsQuery>["queryFn"]>>[number];
