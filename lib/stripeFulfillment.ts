import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { PAYMENT_PLANS, planFromPaymentLinkUrl, type PlanKey } from "@/lib/paymentPlans";

export async function planFromCheckoutSession(
  session: Stripe.Checkout.Session
): Promise<PlanKey | null> {
  const legacyPlan = session.metadata?.plan;
  if (legacyPlan && legacyPlan in PAYMENT_PLANS) return legacyPlan as PlanKey;

  const paymentLinkReference = session.payment_link;
  if (!paymentLinkReference) return null;

  const paymentLink = typeof paymentLinkReference === "string"
    ? await stripe.paymentLinks.retrieve(paymentLinkReference)
    : paymentLinkReference;
  return paymentLink.url ? planFromPaymentLinkUrl(paymentLink.url) : null;
}

export function accessForPurchase(
  user: { plan: string; simRunsLeft: number },
  purchasedPlan: PlanKey
) {
  const purchased = PAYMENT_PLANS[purchasedPlan];
  const currentPlan = user.plan in PAYMENT_PLANS ? user.plan as PlanKey : null;
  const grantedPlan = currentPlan && PAYMENT_PLANS[currentPlan].rank > purchased.rank
    ? currentPlan
    : purchasedPlan;
  const granted = PAYMENT_PLANS[grantedPlan];

  return {
    purchasedPlan,
    grantedPlan,
    simRunsLeft: granted.unlimited
      ? user.simRunsLeft
      : Math.max(user.simRunsLeft, granted.runs),
    unlimitedSims: granted.unlimited,
  };
}
