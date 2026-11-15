import { PRODUCT_CATEGORIES, REGIONS, type Profile } from "./eki.ts";

export function hasTraderDetails(category: string | null, region: string | null): boolean {
  return PRODUCT_CATEGORIES.includes(category ?? "") && REGIONS.includes(region ?? "");
}

export function isProfileComplete(profile: Profile | null): profile is Profile {
  return !!profile?.onboarded && hasTraderDetails(profile.product_category, profile.trading_region);
}

// Only known public/product routes can be resumed. Never accept external URLs,
// auth routes (which could loop), encoded separators, or arbitrary admin paths.
export function safeReturnTo(value: unknown): string {
  if (typeof value !== "string" || /[%\\\s?#]/.test(value)) return "/markets";
  return /^\/(?:markets(?:\/[a-zA-Z0-9_-]+(?:\/review)?)?|organisers\/[a-zA-Z0-9_-]+|account)\/?$/.test(
    value,
  )
    ? value
    : "/markets";
}

export function authDestination(profile: Profile | null, returnTo: unknown) {
  const destination = safeReturnTo(returnTo);
  return isProfileComplete(profile)
    ? destination
    : `/onboarding?returnTo=${encodeURIComponent(destination)}`;
}

export function authSearch(search: Record<string, unknown>): { returnTo?: string } {
  return search.returnTo === undefined ? {} : { returnTo: safeReturnTo(search.returnTo) };
}
