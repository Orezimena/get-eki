import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Market, Review } from "./eki";

export const marketsQuery = {
  queryKey: ["markets"],
  queryFn: async (): Promise<Market[]> => {
    const { data, error } = await supabase.from("markets").select("*").order("name");
    if (error) throw error;
    return data;
  },
};

export const approvedReviewsQuery = {
  queryKey: ["reviews", "approved"],
  queryFn: async (): Promise<Review[]> => {
    const { data, error } = await supabase.from("reviews").select("*").eq("status", "approved");
    if (error) throw error;
    return data;
  },
};

export function useMarkets() {
  return useQuery(marketsQuery);
}

export function useApprovedReviews() {
  return useQuery(approvedReviewsQuery);
}

export function usePendingReviews(enabled: boolean) {
  return useQuery({
    queryKey: ["reviews", "pending"],
    enabled,
    queryFn: async (): Promise<Review[]> => {
      const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useMyVotes(userId: string | undefined) {
  return useQuery({
    queryKey: ["review_votes", userId],
    enabled: !!userId,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("review_votes")
        .select("review_id")
        .eq("user_id", userId!);
      if (error) throw error;
      return data.map((v) => v.review_id);
    },
  });
}
