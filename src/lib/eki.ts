import type { Database } from "@/integrations/supabase/types";

export type Market = Database["public"]["Tables"]["markets"]["Row"];
export type Review = Database["public"]["Tables"]["reviews"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export const REVIEW_THRESHOLD = 5;

export const DIMENSIONS = [
  { key: "footfall_quality", label: "Footfall quality" },
  { key: "crowd_spend_power", label: "Crowd spend power" },
  { key: "organiser_communication", label: "Organiser communication" },
  { key: "stall_fee_vs_return", label: "Stall fee vs return" },
  { key: "setup_logistics", label: "Setup and logistics" },
] as const;

export type DimensionKey = (typeof DIMENSIONS)[number]["key"];

export const PRODUCT_CATEGORIES = [
  "Food and drink",
  "Craft and art",
  "Clothing and accessories",
  "Homeware and gifts",
  "Plants and flowers",
  "Health and beauty",
  "Jewellery",
  "Other",
];

export const REGIONS = [
  "North West",
  "Yorkshire",
  "Midlands",
  "London",
  "South East",
  "South West",
  "Scotland",
  "Wales",
  "Northern Ireland",
];

export const FLAG_REASONS = ["Abusive", "Inaccurate", "Spam", "Conflict of interest"];

export const WOULD_RETURN = ["Yes", "Maybe", "No"] as const;

export type MarketStats = {
  reviewCount: number;
  rated: boolean;
  overall: number | null;
  dimensions: Record<DimensionKey, number> | null;
  wouldReturnPct: number | null;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

export function computeStats(reviews: Review[]): MarketStats {
  const count = reviews.length;
  if (count < REVIEW_THRESHOLD) {
    return { reviewCount: count, rated: false, overall: null, dimensions: null, wouldReturnPct: null };
  }

  const dimensions = {} as Record<DimensionKey, number>;
  let total = 0;
  for (const d of DIMENSIONS) {
    const mean = reviews.reduce((sum, r) => sum + r[d.key], 0) / count;
    dimensions[d.key] = round1(mean);
    total += mean;
  }

  const yes = reviews.filter((r) => r.would_return === "Yes").length;

  return {
    reviewCount: count,
    rated: true,
    overall: round1(total / DIMENSIONS.length),
    dimensions,
    wouldReturnPct: Math.round((yes / count) * 100),
  };
}

export function sortReviews(reviews: Review[]): Review[] {
  return [...reviews].sort(
    (a, b) =>
      b.helpful_count - a.helpful_count ||
      new Date(b.trading_date).getTime() - new Date(a.trading_date).getTime(),
  );
}

export const gbp = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);

export function feeRange(market: Pick<Market, "stall_fee_min" | "stall_fee_max">) {
  return market.stall_fee_min === market.stall_fee_max
    ? gbp(market.stall_fee_min)
    : `${gbp(market.stall_fee_min)}–${gbp(market.stall_fee_max)}`;
}

export function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function organiserSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
