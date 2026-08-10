import assert from "node:assert/strict";
import test from "node:test";
import { PAYMENT_PLANS, planFromPaymentLinkUrl } from "../lib/paymentPlans";
import { accessForPurchase } from "../lib/stripeFulfillment";

test("each Stripe Payment Link resolves to its intended plan", () => {
  for (const [plan, config] of Object.entries(PAYMENT_PLANS)) {
    assert.equal(planFromPaymentLinkUrl(config.url), plan);
  }
});

test("Stripe query parameters do not change the purchased plan", () => {
  assert.equal(
    planFromPaymentLinkUrl(`${PAYMENT_PLANS.standard.url}?client_reference_id=user_123`),
    "standard"
  );
});

test("unknown payment links are not granted a plan", () => {
  assert.equal(planFromPaymentLinkUrl("https://buy.stripe.com/not-a-veltacapital-link"), null);
});

test("a paid plan receives the correct exercise allowance", () => {
  assert.deepEqual(accessForPurchase({ plan: "none", simRunsLeft: 0 }, "starter"), {
    purchasedPlan: "starter",
    grantedPlan: "starter",
    simRunsLeft: 15,
    unlimitedSims: false,
  });
});

test("a lower-tier purchase never removes higher-tier access", () => {
  assert.deepEqual(accessForPurchase({ plan: "premium", simRunsLeft: 0 }, "trial"), {
    purchasedPlan: "trial",
    grantedPlan: "premium",
    simRunsLeft: 0,
    unlimitedSims: true,
  });
});
