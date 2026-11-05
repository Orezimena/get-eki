import assert from "node:assert/strict";
import test from "node:test";
import { computeStats, sortReviews } from "../src/lib/eki.ts";

const review = (overrides = {}) => ({
  status: "approved",
  footfall_quality: 1,
  crowd_spend_power: 2,
  organiser_communication: 3,
  stall_fee_vs_return: 4,
  setup_logistics: 5,
  would_return: "Yes",
  helpful_count: 0,
  trading_date: "2026-01-01",
  ...overrides,
});

test("zero approved reviews have no scores or recommendation percentage", () => {
  const empty = {
    reviewCount: 0,
    rated: false,
    overall: null,
    dimensions: null,
    wouldReturnPct: null,
  };
  assert.deepEqual(computeStats([]), empty);
  assert.deepEqual(
    computeStats([review({ status: "pending" }), review({ status: "rejected" })]),
    empty,
  );
});

test("one approved review immediately supplies all five scores and return context", () => {
  const stats = computeStats([review()]);
  assert.equal(stats.reviewCount, 1);
  assert.equal(stats.rated, true);
  assert.equal(stats.overall, 3);
  assert.deepEqual(stats.dimensions, {
    footfall_quality: 1,
    crowd_spend_power: 2,
    organiser_communication: 3,
    stall_fee_vs_return: 4,
    setup_logistics: 5,
  });
  assert.equal(stats.wouldReturnPct, 100);
  assert.equal(computeStats([review({ would_return: "Maybe" })]).wouldReturnPct, 0);
  assert.equal(computeStats([review({ would_return: "No" })]).wouldReturnPct, 0);
});

test("multiple approved reviews retain averaging and rounding, excluding other statuses", () => {
  const approved = [
    review(),
    review({ footfall_quality: 5, would_return: "Maybe" }),
    review({ would_return: "No" }),
  ];
  const stats = computeStats([
    ...approved,
    review({ status: "pending" }),
    review({ status: "rejected" }),
  ]);
  assert.equal(stats.reviewCount, 3);
  assert.equal(stats.overall, 3.3);
  assert.equal(stats.dimensions.footfall_quality, 2.3);
  assert.equal(stats.wouldReturnPct, 33);
  assert.deepEqual(stats, computeStats(approved));
});

test("two reviews are rated and Helpful sorting still uses trading date to break ties", () => {
  const older = review({ helpful_count: 2 });
  const newer = review({ helpful_count: 2, trading_date: "2026-02-01" });
  const mostHelpful = review({ helpful_count: 3 });
  assert.equal(computeStats([older, newer]).rated, true);
  const input = [older, newer, mostHelpful];
  assert.deepEqual(sortReviews(input), [mostHelpful, newer, older]);
  assert.deepEqual(input, [older, newer, mostHelpful]);
});
