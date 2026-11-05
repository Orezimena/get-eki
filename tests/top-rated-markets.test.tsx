import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { TopRatedMarkets } from "../src/components/TopRatedMarkets";
import { computeStats, type Market } from "../src/lib/eki";

async function render(props: Parameters<typeof TopRatedMarkets>[0]) {
  const rootRoute = createRootRoute({ component: () => createElement(TopRatedMarkets, props) });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  return renderToStaticMarkup(createElement(RouterProvider, { router }));
}

const empty = { markets: [], isPending: false, isError: false };

test("successful empty results invite traders to explore the market directory", async () => {
  const html = await render(empty);
  assert.match(html, /No rated markets yet/);
  assert.match(html, /first traders to share your experiences/);
  assert.match(html, /href="\/markets"[^>]*>Explore markets/);
});

test("pending market or review requests show loading, never the empty invitation", async () => {
  const html = await render({ ...empty, isPending: true });
  assert.match(html, /Loading rated markets/);
  assert.doesNotMatch(html, /No rated markets yet/);
});

test("failed requests show an error, even while the other request is pending", async () => {
  for (const isPending of [true, false]) {
    const html = await render({ ...empty, isPending, isError: true });
    assert.match(html, /couldn&#x27;t load rated markets|couldn't load rated markets/);
    assert.doesNotMatch(html, /No rated markets yet/);
  }
});

test("successful rated results retain market cards rather than the empty invitation", async () => {
  const market = {
    id: 1,
    name: "Test Market",
    slug: "test-market",
    city: "Leeds",
    region: "Yorkshire",
    type: "Craft",
    stall_fee_min: 10,
    stall_fee_max: 20,
  } as Market;
  const stats = { ...computeStats([]), rated: true, overall: 4, reviewCount: 1 };
  const html = await render({ ...empty, markets: [{ market, stats }] });
  assert.match(html, /Test Market/);
  assert.match(html, /1 review/);
  assert.doesNotMatch(html, /No rated markets yet/);
});
