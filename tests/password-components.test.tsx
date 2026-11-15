import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
  Outlet,
} from "@tanstack/react-router";
import { PasswordInput } from "../src/components/PasswordInput";
import { PasswordFeedback, PasswordMatch } from "../src/components/PasswordFeedback";
import { AuthContext, type AuthValue } from "../src/lib/auth";
import { authSearch } from "../src/lib/auth-flow";
import { Route as SignupRoute } from "../src/routes/signup";
import { Route as SigninRoute } from "../src/routes/signin";
import { Route as ResetRoute } from "../src/routes/reset-password";
import { Route as AdminRoute } from "../src/routes/admin/index";

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

async function renderPage(path: string, component: typeof SignupRoute.options.component) {
  const client = new QueryClient({ defaultOptions: { queries: { enabled: false } } });
  const root = createRootRoute({
    component: () => (
      <QueryClientProvider client={client}>
        <AuthContext.Provider value={anonymous}>
          <Outlet />
        </AuthContext.Provider>
      </QueryClientProvider>
    ),
  });
  const route = createRoute({
    getParentRoute: () => root,
    path,
    component,
    validateSearch: authSearch,
  });
  const router = createRouter({
    routeTree: root.addChildren([route]),
    history: createMemoryHistory({ initialEntries: [`/${path}`] }),
  });
  await router.load();
  const html = renderToStaticMarkup(createElement(RouterProvider, { router }));
  client.clear();
  return html;
}

test("password inputs start masked and expose a labelled non-submit visibility control", () => {
  const html = renderToStaticMarkup(
    <PasswordInput
      id="test-password"
      visibilityLabel="test password"
      autoComplete="new-password"
      aria-describedby="guidance"
    />,
  );
  assert.match(html, /type="password"/);
  assert.match(html, /type="button"/);
  assert.match(html, /aria-label="Show test password"/);
  assert.match(html, /aria-controls="test-password"/);
  assert.match(html, /aria-pressed="false"/);
  assert.match(html, /autoComplete="new-password"|autocomplete="new-password"/);
  assert.match(html, /aria-describedby="guidance"/);
});

test("busy password fields disable both input and visibility control", () => {
  const html = renderToStaticMarkup(
    <PasswordInput id="busy" visibilityLabel="password" disabled />,
  );
  assert.equal((html.match(/disabled=""/g) ?? []).length, 2);
});

test("live length feedback never labels a minimum-length password as strong", () => {
  const short = renderToStaticMarkup(<PasswordFeedback id="guide" password="aaaaa" />);
  assert.match(short, /At least 6 characters/);
  assert.match(short, /Minimum length not yet met/);
  const minimum = renderToStaticMarkup(<PasswordFeedback id="guide" password="aaaaaa" />);
  assert.match(minimum, /Minimum length met/);
  assert.match(minimum, /Length alone does not guarantee strength/);
  assert.match(
    minimum,
    /For better security, use a longer, unique passphrase\. Some passwords may be rejected for security reasons\./,
  );
  assert.doesNotMatch(minimum, /Compromised passwords are checked/);
  assert.match(minimum, /role="status"/);
  assert.doesNotMatch(minimum, /Strong password|uppercase|digit|symbol/);
});

test("confirmation feedback supports empty, matching and mismatched inputs", () => {
  const render = (confirmation: string) =>
    renderToStaticMarkup(
      <PasswordMatch id="match" password="aaaaaa" confirmation={confirmation} />,
    );
  assert.match(render(""), /Re-enter your password/);
  assert.match(render("aaaaaa"), /Passwords match/);
  assert.match(render("bbbbbb"), /Passwords do not match/);
});

test("signup and reset retain two new-password fields with feedback and independent visibility controls", async () => {
  for (const [path, component] of [
    ["signup", SignupRoute.options.component],
    ["reset-password", ResetRoute.options.component],
  ] as const) {
    const html = await renderPage(path, component);
    assert.equal((html.match(/type="password"/g) ?? []).length, 2);
    assert.equal((html.match(/aria-label="Show /g) ?? []).length, 2);
    assert.equal(
      (html.match(/autoComplete="new-password"|autocomplete="new-password"/g) ?? []).length,
      2,
    );
    assert.match(html, /At least 6 characters/);
    assert.match(html, /aria-describedby="(?:signup|reset)-password-guidance"/);
    assert.match(html, /aria-busy="false"/);
  }
});

test("regular and admin sign-in use the shared masked current-password control", async () => {
  for (const [path, component] of [
    ["signin", SigninRoute.options.component],
    ["admin", AdminRoute.options.component],
  ] as const) {
    const html = await renderPage(path, component);
    assert.equal((html.match(/type="password"/g) ?? []).length, 1);
    assert.match(html, /aria-label="Show (?:admin )?password"/);
    assert.match(html, /autoComplete="current-password"|autocomplete="current-password"/);
  }
});
