import assert from "node:assert/strict";
import test from "node:test";
import {
  createVerificationStorage,
  createVerificationResend,
  verificationRedirect,
  RESEND_SUCCESS,
} from "../src/lib/verification-email.ts";
import { authSearch } from "../src/lib/auth-flow.ts";

function harness(provider = async () => ({ error: null })) {
  let time = 100_000;
  const items = new Map();
  const browserStorage = {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, value),
    removeItem: (key) => items.delete(key),
  };
  const now = () => time;
  const storage = createVerificationStorage(
    () => browserStorage,
    () => "https://get-eki.lovable.app",
    now,
  );
  const requests = [];
  const resend = async (request) => {
    requests.push(request);
    return provider(request);
  };
  const create = () => createVerificationResend({ storage, resend, now });
  const controller = create();
  return {
    storage,
    controller,
    create,
    requests,
    items,
    browserStorage,
    now,
    advance: (ms) => {
      time += ms;
      controller.tick();
    },
  };
}
function remember(h, returnTo) {
  const redirect = verificationRedirect("https://get-eki.lovable.app", returnTo);
  h.storage.remember("trader@example.com", redirect);
  h.controller.tick();
  return redirect;
}

test("valid resend uses Supabase's signup resend request and the original redirect", async () => {
  const h = harness();
  const redirect = remember(h, "/markets/leeds/review");
  await h.controller.submit();
  assert.deepEqual(h.requests, [
    { type: "signup", email: "trader@example.com", options: { emailRedirectTo: redirect } },
  ]);
  assert.equal(h.controller.getSnapshot().feedback, RESEND_SUCCESS);
  assert.equal(h.controller.getSnapshot().error, false);
  assert.equal(h.controller.getSnapshot().remaining, 60);
});

test("missing or expired signup email never calls the provider", async () => {
  const h = harness();
  await h.controller.submit();
  assert.equal(h.requests.length, 0);
  assert.match(h.controller.getSnapshot().feedback, /Return to signup/);
  remember(h);
  h.advance(60 * 60 * 1000);
  await h.controller.submit();
  assert.equal(h.requests.length, 0);
  assert.equal(h.controller.getSnapshot().target, null);
});

test("invalid stored emails and foreign redirects are discarded", async () => {
  for (const value of [
    { email: "invalid", redirectTo: "https://get-eki.lovable.app/onboarding" },
    { email: "trader@example.com", redirectTo: "https://evil.example/onboarding" },
    {
      email: "trader@example.com",
      redirectTo: "https://get-eki.lovable.app/onboarding?returnTo=https://evil.example",
    },
  ]) {
    const h = harness();
    h.storage.write({ ...value, expiresAt: 999_999, retryAt: 0 });
    await h.controller.submit();
    assert.equal(h.requests.length, 0);
    assert.equal(h.controller.getSnapshot().target, null);
  }
});

test("duplicate clicks while awaiting the provider result in only one request", async () => {
  let resolve;
  const h = harness(
    () =>
      new Promise((yes) => {
        resolve = yes;
      }),
  );
  remember(h);
  const pending = h.controller.submit();
  await h.controller.submit();
  await h.controller.submit();
  assert.equal(h.requests.length, 1);
  assert.equal(h.controller.getSnapshot().pending, true);
  resolve({ error: null });
  await pending;
  assert.equal(h.controller.getSnapshot().pending, false);
});

test("cooldown is 60 seconds, counts down by elapsed time and blocks duplicate clicks", async () => {
  const h = harness();
  remember(h);
  await h.controller.submit();
  await h.controller.submit();
  h.advance(59_000);
  assert.equal(h.controller.getSnapshot().remaining, 1);
  await h.controller.submit();
  assert.equal(h.requests.length, 1);
  h.advance(1000);
  assert.equal(h.controller.getSnapshot().remaining, 0);
  await h.controller.submit();
  assert.equal(h.requests.length, 2);
});

test("cooldown survives page recreation and browser tab refresh", async () => {
  const h = harness();
  remember(h);
  await h.controller.submit();
  h.advance(20_000);
  const storage = createVerificationStorage(
    () => h.browserStorage,
    () => "https://get-eki.lovable.app",
    h.now,
  );
  const refreshed = createVerificationResend({
    storage,
    now: h.now,
    resend: async () => {
      throw new Error("must not request during cooldown");
    },
  });
  refreshed.tick();
  assert.equal(refreshed.getSnapshot().remaining, 40);
  assert.equal(refreshed.getSnapshot().target.email, "trader@example.com");
  await refreshed.submit();
  assert.equal(refreshed.getSnapshot().error, false);
});

test("provider rate limits display safe feedback and apply a retry cooldown", async () => {
  for (const error of [
    { status: 429 },
    { code: "over_email_send_rate_limit" },
    { code: "over_request_rate_limit" },
  ]) {
    const h = harness(async () => ({ error }));
    remember(h);
    await h.controller.submit();
    assert.match(h.controller.getSnapshot().feedback, /Too many requests/);
    assert.equal(h.controller.getSnapshot().remaining, 60);
    assert.equal(h.controller.getSnapshot().pending, false);
    await h.controller.submit();
    assert.equal(h.requests.length, 1);
  }
});

test("provider failures never expose provider text or account existence", async () => {
  for (const provider of [
    async () => ({ error: { status: 400, message: "trader@example.com does not exist" } }),
    async () => {
      throw new Error("secret provider error trader@example.com");
    },
  ]) {
    const h = harness(provider);
    remember(h);
    await h.controller.submit();
    const state = h.controller.getSnapshot();
    assert.equal(state.pending, false);
    assert.equal(state.error, true);
    assert.match(state.feedback, /couldn't request another link/);
    assert.doesNotMatch(state.feedback, /trader@example.com|does not exist|secret provider/);
    assert.equal(state.remaining, 0);
  }
});

test("correcting an email during a pending resend cannot overwrite the new signup details", async () => {
  let resolve;
  const h = harness(
    () =>
      new Promise((yes) => {
        resolve = yes;
      }),
  );
  remember(h);
  const pending = h.controller.submit();
  h.storage.remember("corrected@example.com", verificationRedirect("https://get-eki.lovable.app"));
  resolve({ error: null });
  await pending;
  assert.equal(h.storage.read().email, "corrected@example.com");
  assert.equal(h.storage.read().retryAt, 0);
});

test("blocked browser storage falls back to memory, without breaking resend", async () => {
  const storage = createVerificationStorage(
    () => {
      throw new Error("blocked");
    },
    () => "https://get-eki.lovable.app",
  );
  storage.remember("trader@example.com", verificationRedirect("https://get-eki.lovable.app"));
  let calls = 0;
  const controller = createVerificationResend({
    storage,
    resend: async () => {
      calls++;
      return { error: null };
    },
  });
  await controller.submit();
  assert.equal(calls, 1);
  assert.equal(controller.getSnapshot().remaining, 60);
  storage.clear();
  assert.equal(storage.read(), null);
});

test("signup redirects remain identical on production and preview with or without a return destination", () => {
  for (const origin of ["https://get-eki.lovable.app", "https://preview--get-eki.lovable.app"]) {
    assert.equal(verificationRedirect(origin), `${origin}/onboarding`);
    assert.equal(
      verificationRedirect(origin, "/markets/leeds/review"),
      `${origin}/onboarding?returnTo=%2Fmarkets%2Fleeds%2Freview`,
    );
  }
});

test("verification search excludes the email and retains only a safe destination", () => {
  assert.deepEqual(authSearch({ email: "trader@example.com", returnTo: "/markets/leeds/review" }), {
    returnTo: "/markets/leeds/review",
  });
  assert.deepEqual(authSearch({ email: "trader@example.com" }), {});
});

test("a failed storage write cannot resurrect an older cooldown", async () => {
  let saved = null;
  let writesBlocked = false;
  const browserStorage = {
    getItem: () => saved,
    setItem: (_key, value) => {
      if (writesBlocked) throw new Error("quota");
      saved = value;
    },
    removeItem: () => {
      saved = null;
    },
  };
  const storage = createVerificationStorage(
    () => browserStorage,
    () => "https://get-eki.lovable.app",
  );
  storage.remember("trader@example.com", verificationRedirect("https://get-eki.lovable.app"));
  writesBlocked = true;
  let requests = 0;
  const controller = createVerificationResend({
    storage,
    resend: async () => {
      requests++;
      return { error: null };
    },
  });
  await controller.submit();
  controller.tick();
  await controller.submit();
  assert.equal(requests, 1);
  assert.ok(controller.getSnapshot().remaining > 0);
});

test("loading the verification page never automatically resends an email", () => {
  const h = harness();
  remember(h);
  h.controller.tick();
  h.advance(10_000);
  assert.equal(h.requests.length, 0);
});
