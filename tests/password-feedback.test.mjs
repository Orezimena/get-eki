import assert from "node:assert/strict";
import test from "node:test";
import {
  PASSWORD_MIN_LENGTH,
  passwordFeedback,
  passwordRequestError,
} from "../src/lib/password-feedback.ts";

test("password validation keeps the existing six-character minimum without new composition rules", () => {
  assert.equal(PASSWORD_MIN_LENGTH, 6);
  assert.equal(passwordFeedback("", "").minimumMet, false);
  assert.equal(passwordFeedback("aaaaa", "aaaaa").minimumMet, false);
  for (const value of ["aaaaaa", "123456", "a longer synthetic passphrase", "a".repeat(100)]) {
    assert.equal(passwordFeedback(value, value).error, null);
  }
});

test("confirmation feedback updates independently and reports mismatches", () => {
  const empty = passwordFeedback("aaaaaa", "");
  assert.equal(empty.confirmationStarted, false);
  assert.equal(empty.confirmationMatches, false);
  const mismatch = passwordFeedback("aaaaaa", "bbbbbb");
  assert.equal(mismatch.confirmationStarted, true);
  assert.equal(mismatch.error, "Passwords do not match.");
  assert.equal(passwordFeedback("aaaaaa", "aaaaaa").confirmationMatches, true);
  assert.equal(passwordFeedback("bbbbbb", "aaaaaa").confirmationMatches, false);
});

test("feedback contains only validation results and never returns the entered password", () => {
  const value = "synthetic-private-test-value";
  assert.doesNotMatch(JSON.stringify(passwordFeedback(value, value)), new RegExp(value));
});

test("provider errors are mapped to safe feedback without echoing messages or guessing requirements", () => {
  const fallback = "Please try again.";
  assert.equal(passwordRequestError(new Error("synthetic-private-test-value"), fallback), fallback);
  assert.equal(
    passwordRequestError({ code: "unknown", message: "synthetic-private-test-value" }, fallback),
    fallback,
  );
  const weak = passwordRequestError(
    { code: "weak_password", message: "synthetic-private-test-value" },
    fallback,
  );
  assert.match(weak, /password was rejected/);
  assert.doesNotMatch(weak, /synthetic-private-test-value|uppercase|number|symbol/);
});
