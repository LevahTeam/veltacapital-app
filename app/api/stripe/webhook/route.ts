import { jsonResponse } from "@/lib/http";
import { PAYMENT_PLANS } from "@/lib/paymentPlans";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { accessForPurchase, planFromCheckoutSession } from "@/lib/stripeFulfillment";
import type Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHECKOUT_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
]);

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

async function userFromSession(session: Stripe.Checkout.Session) {
  const checkoutEmail = (session.customer_details?.email || session.customer_email || "").trim();
  const referencedUserId = session.client_reference_id || session.metadata?.userId;
  const select = { id: true, email: true, plan: true, simRunsLeft: true, unlimitedSims: true } as const;

  if (referencedUserId) {
    const referencedUser = await prisma.user.findUnique({ where: { id: referencedUserId }, select });
    if (
      referencedUser &&
      checkoutEmail &&
      referencedUser.email.toLowerCase() === checkoutEmail.toLowerCase()
    ) return referencedUser;
  }

  if (!checkoutEmail) return null;
  return prisma.user.findFirst({
    where: { email: { equals: checkoutEmail, mode: "insensitive" } },
    select,
  });
}

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return jsonResponse({ ok: false, error: "Missing signature or secret" }, 400);
  }

  let event;
  try {
    const requestBody = await req.text();
    event = stripe.webhooks.constructEvent(requestBody, signature, webhookSecret);
  } catch (err) {
    return jsonResponse(
      { ok: false, error: `Signature check failed: ${String(err)}` },
      400
    );
  }

  if (!CHECKOUT_EVENTS.has(event.type)) {
    return jsonResponse({ ok: true, ignored: event.type });
  }

  try {
    const alreadyProcessed = await prisma.processedStripeEvent.findUnique({
      where: { id: event.id },
    });
    if (alreadyProcessed) {
      return jsonResponse({ ok: true, duplicate: event.id });
    }

    const session = event.data.object as Stripe.Checkout.Session;

    if (session.payment_status && session.payment_status !== "paid") {
      return jsonResponse({ ok: true, note: "not paid", status: session.payment_status });
    }

    const plan = await planFromCheckoutSession(session);
    const user = await userFromSession(session);
    const cfg = plan ? PAYMENT_PLANS[plan] : null;

    if (!user || !plan || !cfg) {
      return jsonResponse({
        ok: true,
        note: "unmatched payment link or account",
        paymentLink: session.payment_link,
        email: session.customer_details?.email || session.customer_email || null,
      });
    }

    const access = accessForPurchase(user, plan);

    try {
      await prisma.$transaction([
        prisma.processedStripeEvent.create({ data: { id: event.id } }),
        prisma.user.update({
          where: { id: user.id },
          data: {
            plan: access.grantedPlan,
            simRunsLeft: access.simRunsLeft,
            unlimitedSims: access.unlimitedSims,
            canRedeem: true,
            earnMult: 1.0,
          },
        }),
      ]);
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        return jsonResponse({ ok: true, duplicate: event.id });
      }
      throw err;
    }

    return jsonResponse({
      ok: true,
      purchased: plan,
      granted: access.grantedPlan,
      user: user.id,
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) }, 500);
  }
}
