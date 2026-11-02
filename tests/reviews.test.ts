import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { REVIEW_LIMITS, isReviewStatus, parseReview } from "../lib/reviews";

const valid = {
  displayName: "  Ji  Woo ",
  rating: 4,
  body: "The candle exercise finally made open and close click for me.",
  language: "fr",
  consent: true,
};
const route = readFileSync(new URL("../app/api/reviews/route.ts", import.meta.url), "utf8");
const homepage = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const client = readFileSync(new URL("../public/assets/reviews.js", import.meta.url), "utf8");

function problemFor(changes: Record<string, unknown>) {
  const result = parseReview({ ...valid, ...changes });
  return result.ok ? null : result.problem;
}

test("a valid review is cleaned, not stored verbatim", () => {
  const result = parseReview({ ...valid, body: `${valid.body}\u0007\n\n\n\nThanks.` });
  assert.ok(result.ok);
  assert.equal(result.data.displayName, "Ji Woo");
  assert.ok(!result.data.body.includes("\u0007"));
  assert.ok(!result.data.body.includes("\n\n\n"));
});

test("reviews are rejected for each invalid field", () => {
  assert.equal(problemFor({ displayName: "A" }), "name");
  assert.equal(problemFor({ displayName: "x".repeat(REVIEW_LIMITS.nameMax + 1) }), "name");
  for (const rating of [0, 6, 2.5, "5", null]) assert.equal(problemFor({ rating }), "rating");
  assert.equal(problemFor({ body: "Too short." }), "body");
  assert.equal(problemFor({ body: "x".repeat(REVIEW_LIMITS.bodyMax + 1) }), "body");
  assert.equal(problemFor({ language: "de" }), "language");
  assert.equal(problemFor({ consent: false }), "consent");
  assert.equal(problemFor({ consent: "true" }), "consent");
  assert.equal(parseReview(null).ok, false);
});

test("links and email addresses cannot be published", () => {
  for (const body of [
    "Please go and visit https://example.com for more.",
    "Please go and visit www.example.com for more.",
    "You can write to me at someone@example.com any time.",
  ]) {
    assert.equal(problemFor({ body }), "links");
  }
});

test("status values are limited to the moderation states", () => {
  assert.ok(isReviewStatus("approved"));
  assert.equal(isReviewStatus("published"), false);
});

test("the public route only serves approved reviews and no account data", () => {
  assert.match(route, /where: \{ status: "approved" \}/);
  const fields = route.slice(route.indexOf("PUBLIC_FIELDS = {"), route.indexOf("} as const"));
  assert.doesNotMatch(fields, /userId|email|user:/);
  assert.match(route, /status: "pending", consentAt/);
  for (const handler of ["PATCH", "GET"]) assert.match(route, new RegExp(`function ${handler}`));
  assert.ok((route.match(/isAdmin\(\)/g) ?? []).length >= 3, "moderation paths must check admin");
});

test("the page ships no invented reviews and renders user text safely", () => {
  assert.match(homepage, /id="review-wall"><\/div>/);
  assert.match(homepage, /data-i18n="reviews\.emptyTitle"|"reviews\.emptyTitle"/);
  assert.match(client, /fetch\("\/api\/reviews"\)/);
  assert.doesNotMatch(client, /innerHTML/);
  assert.doesNotMatch(client, /aggregateRating|average/i);
});
