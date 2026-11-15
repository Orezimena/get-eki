import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRoute,
  Outlet,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { AuthContext, type AuthValue } from "../src/lib/auth";
import { TraderAccess } from "../src/components/TraderAccess";
import { Route as SignInRoute } from "../src/routes/signin";
import { Route as OnboardingRoute } from "../src/routes/onboarding";
import { authSearch } from "../src/lib/auth-flow";
import { Route as MarketsRoute } from "../src/routes/markets/index";

const anonymous: AuthValue = {
  user: null,
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
const trader = {
  ...anonymous,
  user: { id: "user-a" } as AuthValue["user"],
  profile: {
    id: "user-a",
    created_at: "",
    email: null,
    onboarded: true,
    product_category: "Other",
    trading_region: "London",
  },
};

async function renderGate(auth: AuthValue) {
  const root = createRootRoute({
    component: () => (
      <AuthContext.Provider value={auth}>
        <TraderAccess returnTo="/markets/leeds/review">
          <form>
            <button>Submit review</button>
          </form>
        </TraderAccess>
      </AuthContext.Provider>
    ),
  });
  const router = createRouter({
    routeTree: root,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  return renderToStaticMarkup(createElement(RouterProvider, { router }));
}

test("direct review access never renders the form for an incomplete or missing profile", async () => {
  for (const profile of [null, { ...trader.profile, onboarded: false }]) {
    const html = await renderGate({ ...trader, profile });
    assert.match(html, /Taking you to the next step/);
    assert.doesNotMatch(html, /Submit review/);
  }
});

test("review access waits for profile loading and shows retry on fetch failure", async () => {
  const pending = await renderGate({ ...trader, loading: true });
  assert.match(pending, /Loading your account/);
  assert.doesNotMatch(pending, /Submit review/);
  const failed = await renderGate({ ...trader, error: "Could not load profile" });
  assert.match(failed, /Could not load profile/);
  assert.match(failed, /Try again/);
  assert.doesNotMatch(failed, /Submit review/);
});

test("anonymous review access preserves the review destination in auth links", async () => {
  const html = await renderGate(anonymous);
  assert.match(html, /Sign in to leave a review/);
  assert.match(html, /returnTo=/);
  assert.doesNotMatch(html, /Submit review/);
});

test("a completed trader can access review submission", async () => {
  assert.match(await renderGate(trader), /Submit review/);
});

test("public market directory renders without an account or AuthProvider", async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { enabled: false } } });
  queryClient.setQueryData(["markets"], []);
  queryClient.setQueryData(["reviews", "approved"], []);
  const Markets = MarketsRoute.options.component!;
  const root = createRootRoute({
    component: () => (
      <QueryClientProvider client={queryClient}>
        <Markets />
      </QueryClientProvider>
    ),
  });
  const router = createRouter({
    routeTree: root,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  const html = renderToStaticMarkup(createElement(RouterProvider, { router }));
  assert.match(html, /market/i);
  assert.doesNotMatch(html, /Sign in to leave a review|Loading your account/);
  queryClient.clear();
});

async function renderAuthPage(path: "signin" | "onboarding", auth: AuthValue) {
  const root = createRootRoute({
    component: () => (
      <AuthContext.Provider value={auth}>
        <Outlet />
      </AuthContext.Provider>
    ),
  });
  const page = createRoute({
    getParentRoute: () => root,
    path,
    validateSearch: authSearch,
    component:
      path === "signin" ? SignInRoute.options.component : OnboardingRoute.options.component,
  });
  const router = createRouter({
    routeTree: root.addChildren([page]),
    history: createMemoryHistory({
      initialEntries: [`/${path}?returnTo=%2Fmarkets%2Fleeds%2Freview`],
    }),
  });
  await router.load();
  return renderToStaticMarkup(createElement(RouterProvider, { router }));
}

test("login waits for auth/profile readiness and does not show a second login form", async () => {
  for (const auth of [{ ...trader, loading: true }, trader, { ...trader, profile: null }]) {
    const html = await renderAuthPage("signin", auth);
    assert.match(html, /Loading your account|Taking you to the next step/);
    assert.doesNotMatch(html, /type="password"/);
  }
  assert.match(await renderAuthPage("signin", anonymous), /type="password"/);
});

test("onboarding renders required profile choices for missing profiles and skips completed users", async () => {
  const missing = await renderAuthPage("onboarding", { ...trader, profile: null });
  assert.match(missing, /Product category/);
  assert.match(missing, /Trading region/);
  assert.match(missing, /Finish setup/);
  const complete = await renderAuthPage("onboarding", trader);
  assert.match(complete, /Taking you to the next step/);
  assert.doesNotMatch(complete, /Finish setup/);
});

test("onboarding fetch errors provide retry without displaying a save form", async () => {
  const html = await renderAuthPage("onboarding", { ...trader, error: "Profile fetch failed" });
  assert.match(html, /Profile fetch failed/);
  assert.match(html, /Try again/);
  assert.doesNotMatch(html, /Finish setup/);
});
