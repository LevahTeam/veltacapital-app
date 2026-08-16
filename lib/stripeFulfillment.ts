import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { PAYMENT_PLANS, planFromPaymentLinkUrl, type PlanKey } from "@/lib/paymentPlans";

export async function planFromCheckoutSession(
  session: Stripe.Checkout.Session
): Promise<PlanKey | null> {
  const metadataPlan = session.metadata?.plan;
  if (metadataPlan && metadataPlan in PAYMENT_PLANS) {
    return metadataPlan as PlanKey;
  }

  const paymentLink = session.payment_link;
  if (paymentLink === null || paymentLink === undefined) return null;

  const resolvedLink =
    typeof paymentLink === "string"
      ? await stripe.paymentLinks.retrieve(paymentLink)
      : paymentLink;
  return resolvedLink.url ? planFromPaymentLinkUrl(resolvedLink.url) : null;
}

export function accessForPurchase(
  user: { plan: string; simRunsLeft: number },
  purchasedPlan: PlanKey
) {
  const existingPlan = user.plan in PAYMENT_PLANS ? (user.plan as PlanKey) : null;
  const purchasedRank = PAYMENT_PLANS[purchasedPlan].rank;
  const keepExistingPlan =
    existingPlan !== null && PAYMENT_PLANS[existingPlan].rank > purchasedRank;
  const grantedPlan = keepExistingPlan ? existingPlan : purchasedPlan;
  const grantedAccess = PAYMENT_PLANS[grantedPlan];

  return {
    purchasedPlan,
    grantedPlan,
    simRunsLeft: grantedAccess.unlimited
      ? user.simRunsLeft
      : Math.max(user.simRunsLeft, grantedAccess.runs),
    unlimitedSims: grantedAccess.unlimited,
  };
}
