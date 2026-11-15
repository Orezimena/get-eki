import assert from "node:assert/strict";
import test from "node:test";
import {
  authDestination,
  authSearch,
  isProfileComplete,
  safeReturnTo,
} from "../src/lib/auth-flow.ts";
import { createAuthState } from "../src/lib/auth-state.ts";

const profile = (id = "user-a", overrides = {}) => ({
  id,
  created_at: "2026-11-15",
  email: null,
  onboarded: true,
  product_category: "Craft and art",
  trading_region: "London",
  ...overrides,
});
const session = (id = "user-a") => ({ user: { id } });
const tick = () => new Promise((resolve) => setTimeout(resolve, 10));
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
function harness(overrides = {}) {
  let listener;
  let clears = 0;
  const saves = [];
  const deps = {
    getSession: async () => session(),
    onSession: (next) => {
      listener = next;
      return () => {};
    },
    loadProfile: async (id) => profile(id),
    loadAdmin: async () => false,
    saveProfile: async (id, exists, fields) => {
      saves.push({ id, exists, fields });
      return profile(id, fields);
    },
    signOut: async () => {},
    clearPrivateData: () => {
      clears++;
    },
    ...overrides,
  };
  const store = createAuthState(deps);
  const stop = store.start();
  return { store, deps, stop, event: (next) => listener(next), saves, clears: () => clears };
}

test("new authenticated and missing-profile users require onboarding", () => {
  for (const value of [
    null,
    profile("user-a", { onboarded: false }),
    profile("user-a", { trading_region: null }),
    profile("user-a", { product_category: "invalid" }),
  ]) {
    assert.equal(isProfileComplete(value), false);
    assert.equal(
      authDestination(value, "/markets/leeds/review"),
      "/onboarding?returnTo=%2Fmarkets%2Fleeds%2Freview",
    );
  }
});

test("completed returning users resume their destination or markets", () => {
  assert.equal(authDestination(profile(), "/markets/leeds/review"), "/markets/leeds/review");
  assert.equal(authDestination(profile(), undefined), "/markets");
});

test("external, encoded, protocol-relative and looping destinations are rejected", () => {
  for (const input of [
    "https://evil.example",
    "//evil.example",
    "/\\evil",
    "/%2fevil",
    "/markets/../admin",
    "/signin",
    "/onboarding",
    "/admin",
    "/markets?next=evil",
    ["/account"],
  ]) {
    assert.equal(safeReturnTo(input), "/markets");
  }
  assert.deepEqual(authSearch({ returnTo: "//evil" }), { returnTo: "/markets" });
  assert.equal(safeReturnTo("/account"), "/account");
});

test("profile loading must finish before routing is permitted", async () => {
  const read = deferred();
  const h = harness({ loadProfile: () => read.promise });
  await tick();
  assert.equal(h.store.getSnapshot().loading, true);
  assert.equal(h.store.getSnapshot().profile, null);
  read.resolve(profile());
  await tick();
  assert.equal(h.store.getSnapshot().loading, false);
  assert.equal(h.store.getSnapshot().profile.id, "user-a");
  h.stop();
});

test("missing profile is distinct from a fetch error and is inserted on save", async () => {
  const h = harness({ loadProfile: async () => null });
  await tick();
  assert.equal(h.store.getSnapshot().error, null);
  assert.equal(h.store.getSnapshot().profile, null);
  await h.store.saveProfile("Craft and art", "London");
  assert.equal(h.saves[0].exists, false);
  assert.equal(isProfileComplete(h.store.getSnapshot().profile), true);
  h.stop();
});

test("existing profile is updated and the returned row must match the saved fields", async () => {
  const h = harness();
  await tick();
  await h.store.saveProfile("Other", "Wales");
  assert.equal(h.saves[0].exists, true);
  assert.equal(h.store.getSnapshot().profile.trading_region, "Wales");
  h.stop();
});

test("denied, zero-row and incomplete saves never mark onboarding complete", async () => {
  for (const saveProfile of [
    async () => {
      throw new Error("denied");
    },
    async () => null,
    async () => profile("user-a", { onboarded: false }),
    async () => profile("another-user"),
  ]) {
    const h = harness({ loadProfile: async () => null, saveProfile });
    await tick();
    await assert.rejects(h.store.saveProfile("Craft and art", "London"));
    assert.equal(h.store.getSnapshot().profile, null);
    h.stop();
  }
});

test("both valid category and region are required before any write", async () => {
  const h = harness();
  await tick();
  for (const [category, region] of [
    ["", "London"],
    ["Other", ""],
    ["fake", "London"],
    ["Other", "fake"],
  ]) {
    await assert.rejects(h.store.saveProfile(category, region));
  }
  assert.equal(h.saves.length, 0);
  h.stop();
});

test("profile errors block actions and can be retried", async () => {
  let fail = true;
  const h = harness({
    loadProfile: async () => {
      if (fail) throw new Error("network");
      return profile();
    },
  });
  await tick();
  assert.match(h.store.getSnapshot().error, /couldn't load/);
  await assert.rejects(h.store.saveProfile("Other", "London"));
  fail = false;
  await h.store.retry();
  assert.equal(h.store.getSnapshot().error, null);
  assert.equal(h.store.getSnapshot().profile.id, "user-a");
  h.stop();
});

test("logout clears identity and caches; a late profile read cannot restore them", async () => {
  const read = deferred();
  const h = harness({ loadProfile: () => read.promise, loadAdmin: async () => true });
  await tick();
  await h.store.signOut();
  read.resolve(profile());
  await tick();
  assert.deepEqual(h.store.getSnapshot(), {
    session: null,
    profile: null,
    isAdmin: false,
    loading: false,
    error: null,
  });
  assert.ok(h.clears() >= 1);
  h.stop();
});

test("switching accounts immediately hides the old profile and rejects late responses", async () => {
  const stale = deferred();
  let readCount = 0;
  const h = harness({
    loadProfile: async (id) => (++readCount === 2 ? stale.promise : profile(id)),
  });
  await tick();
  const refresh = h.store.refreshProfile();
  h.event(session("user-b"));
  assert.equal(h.store.getSnapshot().profile, null);
  assert.equal(h.store.getSnapshot().isAdmin, false);
  await tick();
  stale.resolve(profile("user-a"));
  await refresh;
  assert.equal(h.store.getSnapshot().profile.id, "user-b");
  h.stop();
});

test("a delayed initial session cannot overwrite a newer login event", async () => {
  const initial = deferred();
  const h = harness({ getSession: () => initial.promise });
  h.event(session("user-b"));
  initial.resolve(session("user-a"));
  await tick();
  assert.equal(h.store.getSnapshot().session.user.id, "user-b");
  assert.equal(h.store.getSnapshot().profile.id, "user-b");
  h.stop();
});

test("an in-flight save cannot attach a previous user's profile after switching", async () => {
  const saved = deferred();
  const h = harness({ saveProfile: () => saved.promise });
  await tick();
  const result = h.store.saveProfile("Other", "Wales");
  h.event(session("user-b"));
  saved.resolve(profile("user-a", { product_category: "Other", trading_region: "Wales" }));
  await assert.rejects(result, /account changed/);
  await tick();
  assert.equal(h.store.getSnapshot().profile.id, "user-b");
  h.stop();
});

test("logout failure is reported and leaves private data hidden", async () => {
  const h = harness({
    signOut: async () => {
      throw new Error("offline");
    },
  });
  await tick();
  await assert.rejects(h.store.signOut(), /Sign out failed/);
  assert.equal(h.store.getSnapshot().profile, null);
  assert.equal(h.store.getSnapshot().isAdmin, false);
  assert.match(h.store.getSnapshot().error, /Sign out failed/);
  h.stop();
});

test("anonymous startup finishes without fetching a profile", async () => {
  const h = harness({
    getSession: async () => null,
    loadProfile: () => {
      throw new Error("must not load");
    },
  });
  await tick();
  assert.equal(h.store.getSnapshot().loading, false);
  assert.equal(h.store.getSnapshot().session, null);
  assert.equal(h.store.getSnapshot().error, null);
  h.stop();
});

test("login after logout loads only the new user's profile", async () => {
  const h = harness();
  await tick();
  await h.store.signOut();
  h.event(session("user-b"));
  assert.equal(h.store.getSnapshot().loading, true);
  assert.equal(h.store.getSnapshot().profile, null);
  await tick();
  assert.equal(h.store.getSnapshot().profile.id, "user-b");
  h.stop();
});

test("session restoration errors are visible and retriable", async () => {
  let fail = true;
  const h = harness({
    getSession: async () => {
      if (fail) throw new Error("offline");
      return session();
    },
  });
  await tick();
  assert.equal(h.store.getSnapshot().loading, false);
  assert.match(h.store.getSnapshot().error, /restore your session/);
  fail = false;
  await h.store.retry();
  await tick();
  assert.equal(h.store.getSnapshot().profile.id, "user-a");
  h.stop();
});

test("restarting a provider while a read is pending does not leave loading stuck", async () => {
  const first = deferred();
  let calls = 0;
  const h = harness({ loadProfile: async () => (++calls === 1 ? first.promise : profile()) });
  await tick();
  h.stop();
  const stop = h.store.start();
  await tick();
  assert.equal(h.store.getSnapshot().loading, false);
  assert.equal(h.store.getSnapshot().profile.id, "user-a");
  first.resolve(profile("stale-user"));
  await tick();
  assert.equal(h.store.getSnapshot().profile.id, "user-a");
  stop();
});
