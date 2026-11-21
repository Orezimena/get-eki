import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { AuthContext, type AuthValue } from "../src/lib/auth";
import { Route } from "../src/routes/my-reviews";
import { myReviewsQuery } from "../src/lib/my-reviews";
import { clearPrivateQueries } from "../src/lib/private-cache";
import { createAuthState } from "../src/lib/auth-state";
import { safeReturnTo, authDestination } from "../src/lib/auth-flow";

const auth: AuthValue = {
  user: { id: "owner-a" } as AuthValue["user"],
  session: null,
  profile: null,
  isAdmin: false,
  loading: false,
  error: null,
  refreshProfile: async () => {},
  retry: async () => {},
  saveProfile: async () => {},
  signOut: async () => {},
};
const review = (status = "pending", id = "review-a") => ({
  id,
  status,
  created_at: "2026-11-20T10:00:00Z",
  comment: "My market experience",
  footfall_quality: 4,
  crowd_spend_power: 3,
  organiser_communication: 4,
  stall_fee_vs_return: 5,
  setup_logistics: 4,
  markets: { name: "Test Market", slug: "test-market" },
});
async function renderPage(
  value = auth,
  data: unknown[] | null = [],
  error = false,
  client?: QueryClient,
) {
  const queryClient =
    client ?? new QueryClient({ defaultOptions: { queries: { enabled: false, retry: false } } });
  const key = ["reviews", "mine", value.user?.id];
  if (data) queryClient.setQueryData(key, data);
  if (error)
    queryClient
      .getQueryCache()
      .build(queryClient, { queryKey: key })
      .setState({
        status: "error",
        error: new Error("private backend detail"),
        fetchStatus: "idle",
      });
  const Page = Route.options.component!;
  const root = createRootRoute({
    component: () => (
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={value}>
          <Page />
        </AuthContext.Provider>
      </QueryClientProvider>
    ),
  });
  const router = createRouter({
    routeTree: root,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  const html = renderToStaticMarkup(<RouterProvider router={router} />);
  if (!client) queryClient.clear();
  return html;
}

test("empty history has market navigation and no decision actions", async () => {
  const html = await renderPage();
  assert.match(html, /haven’t submitted any reviews/);
  assert.match(html, /href="\/markets"/);
  assert.doesNotMatch(html, /Edit|Delete|Resubmit/);
});
test("one review shows market link, submission date, average rating and text without requiring onboarding", async () => {
  const html = await renderPage(auth, [review()]);
  for (const text of [
    "Test Market",
    "20 November 2026",
    "4.0 out of 5",
    "My market experience",
    "Pending",
  ])
    assert.ok(html.includes(text));
  assert.match(html, /href="\/markets\/test-market"/);
  assert.doesNotMatch(html, /Taking you to the next step/);
});
test("multiple reviews label all moderation statuses and preserve newest-first query results", async () => {
  const rows = [
    review("rejected", "new"),
    { ...review("approved", "middle"), created_at: "2026-11-19T10:00:00Z" },
    { ...review("pending", "old"), created_at: "2026-11-18T10:00:00Z" },
  ];
  const html = await renderPage(auth, rows);
  assert.ok(html.indexOf("Rejected") < html.indexOf("Published"));
  assert.ok(html.indexOf("Published") < html.indexOf("Pending"));
  assert.equal((html.match(/<article>/g) ?? []).length, 3);
});
test("missing market/comment and unexpected statuses render safe fallbacks", async () => {
  const html = await renderPage(auth, [{ ...review("unknown"), markets: null, comment: null }]);
  assert.match(html, /Market unavailable/);
  assert.match(html, /No written review provided/);
  assert.match(html, /Status unavailable/);
});
test("query loading and errors cannot be mistaken for empty or successful history", async () => {
  assert.match(await renderPage(auth, null), /Loading your reviews/);
  const html = await renderPage(auth, [review()], true);
  assert.match(html, /role="alert"/);
  assert.match(html, /Try again/);
  assert.doesNotMatch(html, /My market experience|haven’t submitted|private backend detail/);
});
test("signed-out, auth-loading and auth-error states never reveal cached private reviews", async () => {
  for (const value of [
    { ...auth, user: null },
    { ...auth, loading: true },
    { ...auth, error: "Account unavailable" },
  ]) {
    const html = await renderPage(value, [review()]);
    assert.doesNotMatch(html, /My market experience|Test Market/);
  }
  const html = await renderPage({ ...auth, user: null });
  assert.match(html, /Sign in to view your reviews/);
  assert.match(html, /returnTo=%2Fmy-reviews/);
});
test("account switching uses the new user's cache only", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { enabled: false } } });
  client.setQueryData(["reviews", "mine", "owner-a"], [review()]);
  const html = await renderPage(
    { ...auth, user: { id: "owner-b" } as AuthValue["user"] },
    null,
    false,
    client,
  );
  assert.match(html, /Loading your reviews/);
  assert.doesNotMatch(html, /My market experience/);
  client.clear();
});

function queryHarness(result: unknown = { data: [], error: null }) {
  const calls: unknown[][] = [];
  const chain: Record<string, (...args: unknown[]) => unknown> = {};
  for (const method of ["select", "eq", "order"])
    chain[method] = (...args) => {
      calls.push([method, ...args]);
      return chain;
    };
  chain.abortSignal = async (...args) => {
    calls.push(["abortSignal", ...args]);
    if (result instanceof Error) throw result;
    return result;
  };
  const client = {
    from: (table: string) => {
      calls.push(["from", table]);
      return chain;
    },
  };
  return {
    calls,
    query: myReviewsQuery(client as Parameters<typeof myReviewsQuery>[0], "owner-a"),
  };
}
test("query filters ownership on server, requests minimal fields, all statuses and newest submission first", async () => {
  const { calls, query } = queryHarness({ data: [review()], error: null });
  const signal = new AbortController().signal;
  assert.deepEqual(query.queryKey, ["reviews", "mine", "owner-a"]);
  assert.equal((await query.queryFn({ signal })).length, 1);
  assert.deepEqual(
    calls.find((c) => c[0] === "eq"),
    ["eq", "user_id", "owner-a"],
  );
  assert.equal(calls.filter((c) => c[0] === "eq").length, 1);
  assert.deepEqual(
    calls.filter((c) => c[0] === "order"),
    [
      ["order", "created_at", { ascending: false }],
      ["order", "id", { ascending: false }],
    ],
  );
  const select = calls.find((c) => c[0] === "select")![1] as string;
  assert.doesNotMatch(select, /\*|user_id|legacy_id|email|helpful_count|trading_region/);
  assert.match(select, /markets\(name,slug\)/);
  assert.equal(calls.at(-1)![1], signal);
});
test("database and network failures reject; missing identity never queries", async () => {
  for (const result of [
    { data: null, error: new Error("denied") },
    new Error("offline"),
    { data: null, error: null },
  ]) {
    await assert.rejects(
      queryHarness(result).query.queryFn({ signal: new AbortController().signal }),
    );
  }
  const client = {
    from: () => {
      throw new Error("must not query");
    },
  };
  await assert.rejects(
    myReviewsQuery(client as Parameters<typeof myReviewsQuery>[0], "").queryFn({
      signal: new AbortController().signal,
    }),
    /Sign in/,
  );
});
test("real auth transitions clear private histories on switch and logout, retaining public caches", async () => {
  const client = new QueryClient();
  let event: (
    session: Parameters<Parameters<typeof createAuthState>[0]["onSession"]>[0] extends (
      value: infer S,
    ) => void
      ? S
      : never,
  ) => void = () => {};
  const store = createAuthState({
    getSession: async () => null,
    onSession: (listener) => {
      event = listener;
      return () => {};
    },
    loadProfile: async () => null,
    loadAdmin: async () => false,
    saveProfile: async () => null,
    signOut: async () => {},
    clearPrivateData: () => clearPrivateQueries(client),
  });
  const stop = store.start();
  await new Promise((resolve) => setTimeout(resolve, 0));
  event({ user: { id: "owner-a" } });
  client.setQueryData(["reviews", "approved"], ["public"]);
  client.setQueryData(["markets"], ["public"]);
  client.setQueryData(["reviews", "mine", "owner-a"], [review()]);
  event({ user: { id: "owner-b" } });
  assert.equal(client.getQueryData(["reviews", "mine", "owner-a"]), undefined);
  client.setQueryData(["reviews", "mine", "owner-b"], [review()]);
  await store.signOut();
  assert.equal(client.getQueryData(["reviews", "mine", "owner-b"]), undefined);
  assert.deepEqual(client.getQueryData(["reviews", "approved"]), ["public"]);
  assert.deepEqual(client.getQueryData(["markets"]), ["public"]);
  assert.equal(store.getSnapshot().session, null);
  stop();
  client.clear();
});
test("cancelled in-flight private requests cannot repopulate the cache after logout", async () => {
  const client = new QueryClient();
  let resolve!: (value: string[]) => void;
  const result = client
    .fetchQuery({
      queryKey: ["reviews", "mine", "owner-a"],
      queryFn: () =>
        new Promise<string[]>((yes) => {
          resolve = yes;
        }),
    })
    .catch(() => undefined);
  clearPrivateQueries(client);
  resolve(["private"]);
  await result;
  assert.equal(client.getQueryData(["reviews", "mine", "owner-a"]), undefined);
  client.clear();
});
test("My Reviews is a safe return destination and both signed-in navigation variants include it", () => {
  assert.equal(safeReturnTo("/my-reviews"), "/my-reviews");
  assert.equal(authDestination(null, "/my-reviews"), "/onboarding?returnTo=%2Fmy-reviews");
  const source = readFileSync(new URL("../src/components/SiteChrome.tsx", import.meta.url), "utf8");
  assert.equal((source.match(/to="\/my-reviews"/g) ?? []).length, 2);
  assert.match(source, /<DropdownMenuItem asChild>\s*<Link to="\/my-reviews">My Reviews<\/Link>/);
});
