import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { AuthContext, type AuthValue } from "../src/lib/auth";
import { Route as AdminRoute } from "../src/routes/admin/index";
import { ReviewDecisionActions } from "../src/components/ReviewDecisionActions";

const admin: AuthValue = {
  user: { id: "admin-a" } as AuthValue["user"],
  session: null,
  profile: null,
  isAdmin: true,
  loading: false,
  error: null,
  retry: async () => {},
  refreshProfile: async () => {},
  saveProfile: async () => {},
  signOut: async () => {},
};
const review = {
  id: "review-a",
  market_id: 1,
  status: "pending",
  trading_date: "2026-11-01",
  created_at: "2026-11-02",
  product_category: "Other",
  trading_region: "London",
  footfall_quality: 3,
  crowd_spend_power: 3,
  organiser_communication: 3,
  stall_fee_vs_return: 3,
  setup_logistics: 3,
  comment: "Synthetic review",
};

async function renderQueue({ fail = false, stale = false, loading = false } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["markets"], [{ id: 1, name: "Test Market" }]);
  const query = client
    .getQueryCache()
    .build(client, { queryKey: ["reviews", "pending"], queryFn: async () => [] });
  if (loading) query.setState({ status: "pending", fetchStatus: "fetching" });
  else {
    client.setQueryData(["reviews", "pending"], stale ? [review] : []);
    if (fail) query.setState({ status: "error", error: new Error("fixture"), fetchStatus: "idle" });
  }
  const Admin = AdminRoute.options.component!;
  const root = createRootRoute({
    component: () => (
      <QueryClientProvider client={client}>
        <AuthContext.Provider value={admin}>
          <Admin />
        </AuthContext.Provider>
      </QueryClientProvider>
    ),
  });
  const router = createRouter({
    routeTree: root,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  const html = renderToStaticMarkup(createElement(RouterProvider, { router }));
  client.clear();
  return html;
}

test("a failed queue is an error with retry, never an empty queue or stale actionable cards", async () => {
  for (const stale of [false, true]) {
    const html = await renderQueue({ fail: true, stale });
    assert.match(html, /role="alert"/);
    assert.match(
      html,
      /couldn&#x27;t load the moderation queue|couldn't load the moderation queue/,
    );
    assert.match(html, /Try again/);
    assert.doesNotMatch(html, /queue is clear|Synthetic review|>Approve</);
  }
});

test("only a successfully loaded empty queue displays the empty state", async () => {
  assert.match(await renderQueue(), /Nothing pending — the queue is clear/);
  assert.doesNotMatch(await renderQueue({ loading: true }), /queue is clear/);
});

test("pending queue cards retain approval and dialog-triggered rejection controls", async () => {
  const html = await renderQueue({ stale: true });
  assert.match(html, /Synthetic review/);
  assert.match(html, />Approve</);
  assert.match(html, />Reject</);
  assert.match(html, /aria-haspopup="dialog"/);
  assert.doesNotMatch(html, /Review approved|Review rejected/);
});

test("decision controls can be disabled together while refreshing the queue", () => {
  const html = renderToStaticMarkup(
    <ReviewDecisionActions
      reviewId="review-a"
      disabled
      onSettled={() => {
        throw new Error("render must not mutate");
      }}
    />,
  );
  assert.equal((html.match(/disabled=""/g) ?? []).length, 2);
  assert.match(html, /aria-haspopup="dialog"/);
});
