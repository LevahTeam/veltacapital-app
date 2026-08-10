// lib/stripe.ts
// Shared Stripe client. The secret key comes ONLY from an environment
// variable: it must never be hard-coded or committed to git.
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;

// Use a harmless placeholder if the key is missing so the app can build.
// Automatic plan fulfillment still requires the real key and webhook secret.
export const stripe = new Stripe(key || "sk_test_placeholder_not_configured", {});
