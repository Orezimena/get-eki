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
import { VerificationEmailPanel } from "../src/components/VerificationEmailPanel";
import { RESEND_SUCCESS, type ResendState } from "../src/lib/verification-email";

const ready: ResendState = {
  target: {
    email: "trader@example.com",
    redirectTo: "https://get-eki.lovable.app/onboarding",
    expiresAt: 999999,
    retryAt: 0,
  },
  ready: true,
  pending: false,
  remaining: 0,
  feedback: null,
  error: false,
};
async function render(state: ResendState) {
  const root = createRootRoute({
    component: () => (
      <VerificationEmailPanel
        state={state}
        returnTo="/markets/leeds/review"
        onResend={() => {
          throw new Error("SSR must never send email");
        }}
      />
    ),
  });
  const router = createRouter({
    routeTree: root,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  return renderToStaticMarkup(createElement(RouterProvider, { router }));
}

test("verification shows resend and correction/signin links without email query parameters", async () => {
  const html = await render(ready);
  assert.match(html, /Resend verification email/);
  assert.match(html, /Return to signup/);
  assert.match(html, /Back to sign in/);
  assert.match(html, /break-all/);
  assert.doesNotMatch(html, /email=|email%3D/);
  assert.match(html, /returnTo=/);
  assert.doesNotMatch(html, /disabled=""/);
});

test("missing email disables resend and explains how to return to signup", async () => {
  const html = await render({ ...ready, target: null });
  assert.match(html, /disabled=""/);
  assert.match(html, /signup email isn&#x27;t available|signup email isn't available/);
  assert.match(html, /Return to signup/);
});

test("pending and cooling-down requests disable resend with an accessible visible countdown", async () => {
  const pending = await render({ ...ready, pending: true });
  assert.match(pending, /Requesting another link/);
  assert.match(pending, /disabled=""/);
  const cooling = await render({ ...ready, remaining: 60 });
  assert.match(cooling, /disabled=""/);
  assert.match(cooling, /aria-describedby="resend-cooldown"/);
  assert.match(cooling, /60 seconds/);
  assert.match(cooling, /aria-live="off"/);
});

test("feedback uses status/alert roles and never promises inbox delivery", async () => {
  const success = await render({ ...ready, feedback: RESEND_SUCCESS });
  assert.match(success, /role="status"/);
  assert.match(success, /If this address has an account awaiting verification/);
  assert.doesNotMatch(success, /We&#x27;ve sent|email delivered/i);
  const failure = await render({
    ...ready,
    feedback: "Too many requests. Please wait.",
    error: true,
  });
  assert.match(failure, /role="alert"/);
});
