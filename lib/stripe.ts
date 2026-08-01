// lib/stripe.ts
// Shared Stripe client. The secret key comes ONLY from an environment
// variable — it must never be hard-coded or committed to git.
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  // Fail loudly at startup if the key is missing, rather than silently
  // breaking checkout later.
  throw new Error("STRIPE_SECRET_KEY is not set in the environment.");
}

export const stripe = new Stripe(key, {
  // Pin an API version so Stripe can't change behavior under you.
  // apiVersion omitted: the installed SDK pins its own default, which
  // matches these types. Set explicitly only if Stripe support tells you to.
});

// Maps your plan keys to the Stripe Price IDs you create in the dashboard.
// These are PRICE ids (price_...), not product ids. Test-mode ids start the
// same way; you'll swap the env values when you go live. Kept in env so the
// same code works in test and live without edits.
export const PRICE_IDS: Record<string, string | undefined> = {
  trial:    process.env.STRIPE_PRICE_TRIAL,
  starter:  process.env.STRIPE_PRICE_STARTER,
  standard: process.env.STRIPE_PRICE_STANDARD,
  premium:  process.env.STRIPE_PRICE_PREMIUM,
};
