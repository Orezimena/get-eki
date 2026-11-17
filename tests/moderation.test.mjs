import assert from "node:assert/strict";
import test from "node:test";
import { createReviewDecision } from "../src/lib/moderation.ts";
import { computeStats } from "../src/lib/eki.ts";

function fakeClient(respond) {
  const calls = [];
  return {
    calls,
    from(table) {
      calls.push(["from", table]);
      return {
        update(values) {
          calls.push(["update", values]);
          const filters = {};
          const query = {
            eq(column, value) {
              calls.push(["eq", column, value]);
              filters[column] = value;
              return query;
            },
            select(columns) {
              calls.push(["select", columns]);
              return respond(values, filters);
            },
          };
          return query;
        },
        delete() {
          throw new Error("Moderation must not delete reviews");
        },
      };
    },
  };
}

for (const status of ["approved", "rejected"]) {
  test(`${status} uses a conditional pending UPDATE and verifies the minimal returned fields`, async () => {
    const client = fakeClient(async () => ({ data: [{ id: "review-a", status }], error: null }));
    const result = await createReviewDecision(client).decide("review-a", status);
    assert.deepEqual(result, { kind: "success", status });
    assert.deepEqual(client.calls, [
      ["from", "reviews"],
      ["update", { status }],
      ["eq", "id", "review-a"],
      ["eq", "status", "pending"],
      ["select", "id,status"],
    ]);
  });
}

test("rejection retains the synthetic review identity/content and excludes it from rating calculations", async () => {
  const row = {
    id: "review-a",
    user_id: "author-a",
    status: "pending",
    comment: "Test review",
    footfall_quality: 5,
    crowd_spend_power: 5,
    organiser_communication: 5,
    stall_fee_vs_return: 5,
    setup_logistics: 5,
    would_return: "Yes",
  };
  const original = { ...row };
  const client = fakeClient(async (values, filters) => {
    assert.equal(filters.status, row.status);
    Object.assign(row, values);
    return { data: [{ id: row.id, status: row.status }], error: null };
  });
  assert.equal((await createReviewDecision(client).decide(row.id, "rejected")).kind, "success");
  assert.deepEqual(row, { ...original, status: "rejected" });
  assert.equal(computeStats([row]).reviewCount, 0);
  assert.equal(computeStats([row]).overall, null);
});

test("database errors never produce success, expose raw details or leave the lock set", async () => {
  const client = fakeClient(async () => ({
    data: null,
    error: { message: "private provider detail" },
  }));
  const decision = createReviewDecision(client);
  const result = await decision.decide("review-a", "rejected");
  assert.equal(result.kind, "error");
  assert.doesNotMatch(result.message, /private provider detail/);
  assert.equal(decision.isPending(), false);
});

test("network failures report an uncertain result and allow recovery after refresh", async () => {
  let fail = true;
  const client = fakeClient(async () => {
    if (fail) throw new Error("offline");
    return { data: [{ id: "review-a", status: "approved" }], error: null };
  });
  const decision = createReviewDecision(client);
  const result = await decision.decide("review-a", "approved");
  assert.equal(result.kind, "error");
  assert.match(result.message, /Refresh the queue/);
  assert.equal(decision.isPending(), false);
  fail = false;
  assert.equal((await decision.decide("review-a", "approved")).kind, "success");
});

test("zero rows, multiple rows and mismatching returned rows never produce success", async () => {
  for (const data of [
    [],
    null,
    [{ id: "other", status: "approved" }],
    [{ id: "review-a", status: "pending" }],
    [
      { id: "review-a", status: "approved" },
      { id: "review-b", status: "approved" },
    ],
  ]) {
    const decision = createReviewDecision(fakeClient(async () => ({ data, error: null })));
    const result = await decision.decide("review-a", "approved");
    assert.equal(result.kind, "error");
    assert.match(result.message, /could not be confirmed/);
    assert.equal(decision.isPending(), false);
  }
});

test("duplicate and conflicting clicks during an in-flight request start only one update", async () => {
  let resolve;
  const client = fakeClient(
    () =>
      new Promise((yes) => {
        resolve = yes;
      }),
  );
  const decision = createReviewDecision(client);
  const first = decision.decide("review-a", "approved");
  assert.equal(decision.isPending(), true);
  assert.deepEqual(await decision.decide("review-a", "approved"), { kind: "ignored" });
  assert.deepEqual(await decision.decide("review-a", "rejected"), { kind: "ignored" });
  assert.equal(client.calls.filter(([method]) => method === "update").length, 1);
  resolve({ data: [{ id: "review-a", status: "approved" }], error: null });
  assert.equal((await first).kind, "success");
  assert.equal(decision.isPending(), false);
});

test("a second admin or repeated decision cannot overwrite a completed synthetic transition", async () => {
  const row = { id: "review-a", status: "pending" };
  const client = fakeClient(async (values, filters) => {
    if (row.id !== filters.id || row.status !== filters.status) return { data: [], error: null };
    Object.assign(row, values);
    return { data: [{ ...row }], error: null };
  });
  const first = createReviewDecision(client);
  const second = createReviewDecision(client);
  const results = await Promise.all([
    first.decide(row.id, "approved"),
    second.decide(row.id, "rejected"),
  ]);
  assert.deepEqual(
    results.map((r) => r.kind),
    ["success", "error"],
  );
  assert.equal(row.status, "approved");
  assert.equal((await first.decide(row.id, "approved")).kind, "error");
});
