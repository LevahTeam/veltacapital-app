// lib/stripe.ts
// Shared Stripe client. The secret key comes ONLY from an environment
// variable — it must never be hard-coded or committed to git.
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;

// Use a harmless placeholder if the key is missing so the app can BUILD
// without Stripe configured. The checkout/webhook routes still won't work
// until you set the real key — they'll just error at call time, not build time.
export const stripe = new Stripe(key || "sk_test_placeholder_not_configured", {});

// Maps your plan keys to the Stripe Price IDs you create in the dashboard.
export const PRICE_IDS: Record<string, string | undefined> = {
  trial:    process.env.STRIPE_PRICE_TRIAL,
  starter:  process.env.STRIPE_PRICE_STARTER,
  standard: process.env.STRIPE_PRICE_STANDARD,
  premium:  process.env.STRIPE_PRICE_PREMIUM,
};
