import Stripe from "stripe";

const FALLBACK_STRIPE_KEY = "sk_test_placeholder_not_configured";

function stripeKey() {
  return process.env.STRIPE_SECRET_KEY || FALLBACK_STRIPE_KEY;
}

export const stripe = new Stripe(stripeKey(), {});
