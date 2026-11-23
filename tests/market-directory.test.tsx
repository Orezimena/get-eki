import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { Route } from "../src/routes/markets/index";
import { computeStats, type Market } from "../src/lib/eki";
import { directoryResults, type DirectoryFilters } from "../src/lib/market-directory";

const market = (id: number, changes: Partial<Market> = {}): Market => ({
  id,
  name: "Leeds Makers",
  city: "Leeds",
  slug: `market-${id}`,
  region: "Yorkshire",
  location: "Town Hall",
  type: "Craft",
  stall_fee_min: 25,
  stall_fee_max: 50,
  categories_accepted: [],
  created_at: "2026-11-23",
  description: null,
  frequency: null,
  hours: null,
  organiser: null,
  postcode: null,
  typical_days: null,
  ...changes,
});
const markets = [
  market(1),
  market(2, {
    name: "Food Fair",
    city: "London",
    region: "London",
    type: "Food",
    stall_fee_min: null,
    stall_fee_max: null,
  }),
];
const defaults: DirectoryFilters = {
  search: "",
  types: [],
  region: null,
  feeLimit: null,
  minScore: null,
  ratedOnly: false,
};
const rows = markets.map((market, i) => ({
  market,
  stats:
    i === 0 ? { ...computeStats([]), rated: true, overall: 4, reviewCount: 1 } : computeStats([]),
}));

async function renderDirectory(data: Market[] | null) {
  const client = new QueryClient({ defaultOptions: { queries: { enabled: false } } });
  if (data !== null) client.setQueryData(["markets"], data);
  else
    client
      .getQueryCache()
      .build(client, { queryKey: ["markets"] })
      .setState({ status: "pending", fetchStatus: "fetching" });
  client.setQueryData(["reviews", "approved"], []);
  const Page = Route.options.component!;
  // Deliberately no AuthProvider: this page and its suggestion link are public.
  const root = createRootRoute({
    component: () => (
      <QueryClientProvider client={client}>
        <Page />
      </QueryClientProvider>
    ),
  });
  const router = createRouter({
    routeTree: root,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  const html = renderToStaticMarkup(<RouterProvider router={router} />);
  client.clear();
  return html;
}
function suggestion(html: string) {
  const links =
    html.match(/<a\b[^>]*href="https:\/\/forms\.gle\/JDL6aSWgUGZHm5L56"[^>]*>[\s\S]*?<\/a>/g) ?? [];
  assert.equal(links.length, 1, "There must be exactly one suggestion link");
  assert.match(links[0], /target="_blank"/);
  assert.match(links[0], /rel="noopener noreferrer"/);
  assert.match(links[0], /Can(?:&#x27;|')t find your market\? Suggest a market/);
  assert.match(links[0], /opens in a new tab/);
  assert.match(links[0], /min-h-11/);
  assert.match(links[0], /focus-visible:ring-2/);
  assert.doesNotMatch(links[0], /tabindex="-1"|aria-hidden="true"/);
}

test("public directory places one safe suggestion link below search and preserves unrated cards and dynamic count", async () => {
  const html = await renderDirectory(markets);
  suggestion(html);
  const index = html.indexOf("https://forms.gle/");
  assert.ok(html.indexOf('aria-label="Search markets"') < index);
  assert.ok(index < html.indexOf("Market type"));
  assert.match(html, /2 UK popup markets to explore/);
  assert.doesNotMatch(html, /rated by traders/);
  assert.match(html, /Leeds Makers/);
  assert.match(html, /Food Fair/);
  assert.match(html, /No reviews yet/);
});
test("empty search-results state contains the only suggestion link and keeps a neutral zero count", async () => {
  const html = await renderDirectory([]);
  suggestion(html);
  assert.ok(html.indexOf("No markets found") < html.indexOf("https://forms.gle/"));
  assert.match(html, /0 UK popup markets to explore/);
});
test("loading directory retains a single public suggestion link below search", async () => {
  const html = await renderDirectory(null);
  suggestion(html);
  assert.doesNotMatch(html, /No markets found/);
});
test("search still matches trimmed names and cities without case sensitivity", () => {
  for (const search of [" MAKERS ", "leEDS"]) {
    const result = directoryResults(rows, { ...defaults, search });
    assert.deepEqual(
      result.searched.map((r) => r.market.id),
      [1],
    );
    assert.deepEqual(
      result.filtered.map((r) => r.market.id),
      [1],
    );
  }
  assert.deepEqual(
    directoryResults(rows, { ...defaults, search: "london" }).filtered.map((r) => r.market.id),
    [2],
  );
  assert.equal(
    directoryResults(rows, { ...defaults, search: "unknown market" }).searched.length,
    0,
  );
});
test("type, region, price, minimum score and rated-only filters keep their behaviour", () => {
  for (const filters of [
    { types: ["Craft"] },
    { region: "Yorkshire" },
    { feeLimit: 25 },
    { minScore: 4 },
    { ratedOnly: true },
  ]) {
    assert.deepEqual(
      directoryResults(rows, { ...defaults, ...filters }).filtered.map((r) => r.market.id),
      [1],
    );
  }
  assert.equal(directoryResults(rows, { ...defaults, feeLimit: 20 }).filtered.length, 0);
  assert.equal(directoryResults(rows, { ...defaults, minScore: 4.5 }).filtered.length, 0);
  assert.equal(
    directoryResults(rows, { ...defaults, region: "London", ratedOnly: true }).filtered.length,
    0,
  );
  // Unknown fees stay visible with Any and do not satisfy an explicit budget.
  assert.equal(directoryResults(rows, defaults).filtered.length, 2);
});
test("search-empty and filter-empty states remain distinct, and clearing filters restores search matches", () => {
  const hidden = directoryResults(rows, { ...defaults, search: "Leeds", types: ["Food"] });
  assert.equal(hidden.searched.length, 1);
  assert.equal(hidden.filtered.length, 0);
  assert.equal(directoryResults(rows, { ...defaults, search: "Leeds" }).filtered.length, 1);
  assert.equal(
    directoryResults(rows, { ...defaults, search: "missing", types: ["Food"] }).searched.length,
    0,
  );
});
