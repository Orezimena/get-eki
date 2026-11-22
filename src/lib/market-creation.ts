import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { REGIONS, type Market } from "./eki";

const text = (label: string, max = 160) =>
  z
    .string()
    .trim()
    .transform((value) => value.replace(/\s+/g, " "))
    .pipe(z.string().min(1, `${label} is required.`).max(max));
const fee = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || /^\d+$/.test(value),
    "Enter a non-negative whole-pound amount, without pence.",
  )
  .transform((value) => (value === "" ? null : Number(value)))
  .refine(
    (value) => value === null || (Number.isSafeInteger(value) && value <= 100000),
    "Enter a fee no greater than £100,000.",
  );
const marketSchema = z
  .object({
    name: text("Market name"),
    city: text("City or town"),
    location: text("Location", 300),
    region: z.string().refine((value) => REGIONS.includes(value), "Choose a region."),
    type: text("Market type", 80),
    slug: z
      .string()
      .trim()
      .max(160)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Use lowercase letters, numbers and single hyphens for the URL.",
      ),
    description: z.string().trim().max(2000),
    organiser: z.string().trim().max(160).default(""),
    frequency: z.string().trim().max(160).default(""),
    hours: z.string().trim().max(160).default(""),
    typical_days: z.string().trim().max(160).default(""),
    postcode: z.string().trim().max(30).default(""),
    categories_accepted: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
    stall_fee_min: fee,
    stall_fee_max: fee,
  })
  .superRefine(checkFeeRange);
function checkFeeRange(
  value: { stall_fee_min: number | null; stall_fee_max: number | null },
  ctx: z.RefinementCtx,
) {
  if ((value.stall_fee_min === null) !== (value.stall_fee_max === null))
    ctx.addIssue({
      code: "custom",
      path: ["stall_fee_max"],
      message: "Enter both fees, or leave both blank if unknown.",
    });
  if (
    value.stall_fee_min !== null &&
    value.stall_fee_max !== null &&
    value.stall_fee_min > value.stall_fee_max
  )
    ctx.addIssue({
      code: "custom",
      path: ["stall_fee_max"],
      message: "Maximum fee must be at least the minimum fee.",
    });
}

export const marketDraftSchema = marketSchema;
export function marketEditSchema(existing: Pick<Market, "slug" | "region">) {
  return marketSchema
    .innerType()
    .extend({
      slug: z.literal(existing.slug),
      region: z
        .string()
        .refine(
          (value) => value === existing.region || REGIONS.includes(value),
          "Choose a region.",
        ),
    })
    .superRefine(checkFeeRange);
}
export type MarketDraft = z.input<typeof marketDraftSchema>;
export function marketSlug(name: string, city: string) {
  return `${name} ${city}`
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 160)
    .replace(/-$/, "");
}
const literalPattern = (value: string) => value.replace(/[\\%_]/g, "\\$&");

export function marketDraftFromRecord(market: Market): MarketDraft {
  return {
    name: market.name,
    city: market.city,
    location: market.location,
    region: market.region,
    type: market.type,
    slug: market.slug,
    description: market.description ?? "",
    organiser: market.organiser ?? "",
    frequency: market.frequency ?? "",
    hours: market.hours ?? "",
    typical_days: market.typical_days ?? "",
    postcode: market.postcode ?? "",
    categories_accepted: [...market.categories_accepted],
    stall_fee_min: market.stall_fee_min === null ? "" : String(market.stall_fee_min),
    stall_fee_max: market.stall_fee_max === null ? "" : String(market.stall_fee_max),
  };
}

export function createMarketCreator(
  client: Pick<SupabaseClient<Database>, "from">,
  existing?: Pick<Market, "id" | "slug" | "region">,
) {
  let saving = false;
  return async (draft: MarketDraft) => {
    if (saving) throw new Error("A market is already being saved.");
    // Existing slugs are immutable, including legacy URLs that do not follow
    // the current creation format. Validate the other fields normally.
    const values = (existing ? marketEditSchema(existing) : marketDraftSchema).parse(draft);
    if (existing) {
      if (!Number.isSafeInteger(existing.id) || existing.id <= 0 || draft.slug !== existing.slug)
        throw new Error("The market identity or URL changed. Reload before saving.");
      values.slug = existing.slug;
    }
    saving = true;
    try {
      let slugQuery = client.from("markets").select("id").eq("slug", values.slug);
      let duplicateQuery = client
        .from("markets")
        .select("id")
        .ilike("name", literalPattern(values.name))
        .ilike("city", literalPattern(values.city))
        .ilike("location", literalPattern(values.location));
      if (existing) {
        slugQuery = slugQuery.neq("id", existing.id);
        duplicateQuery = duplicateQuery.neq("id", existing.id);
      }
      const [slug, duplicate] = await Promise.all([slugQuery.limit(1), duplicateQuery.limit(1)]);
      if (slug.error || duplicate.error)
        throw new Error("Could not check existing markets. Please try again.");
      if (slug.data?.length)
        throw new Error("That market URL is already in use. Choose another URL.");
      if (duplicate.data?.length)
        throw new Error("A market with this name, city and location already exists.");
      const { slug: preservedSlug, ...editable } = values;
      const fields = {
        ...editable,
        description: values.description || null,
        organiser: values.organiser || null,
        frequency: values.frequency || null,
        hours: values.hours || null,
        typical_days: values.typical_days || null,
        postcode: values.postcode || null,
      };
      const mutation = existing
        ? client.from("markets").update(fields).eq("id", existing.id).eq("slug", existing.slug)
        : client.from("markets").insert({ ...fields, slug: preservedSlug });
      const { data, error } = await mutation.select("id,slug").single();
      if (error?.code === "23505")
        throw new Error(
          "This market or URL already exists. Check the directory before trying again.",
        );
      if (
        error ||
        !data ||
        !Number.isSafeInteger(data.id) ||
        data.slug !== values.slug ||
        (existing && data.id !== existing.id)
      )
        throw new Error(
          existing
            ? "Could not confirm the market was updated. It may have changed or access was denied. Reload before trying again."
            : "Could not confirm the market was created. Check the directory before trying again.",
        );
      return data;
    } finally {
      saving = false;
    }
  };
}
