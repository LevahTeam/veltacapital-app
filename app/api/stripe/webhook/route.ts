// ============================================================
//  POST /api/stripe/webhook
//  Stripe calls this after a payment. This is the ONLY place a plan is
//  granted. Three safety layers:
//   1) Signature check: proves the request is really from Stripe.
//   2) Idempotency: a repeated event cannot grant a plan twice.
//   3) Payment Link and email lookup: identifies the plan and account.
//  File location: app/api/stripe/webhook/route.ts
// ============================================================
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { PAYMENT_PLANS } from "@/lib/paymentPlans";
import { accessForPurchase, planFromCheckoutSession } from "@/lib/stripeFulfillment";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

// Stripe must read the RAW request body to verify the signature, so we
// disable any body parsing/caching for this route.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const sig = req.headers.get("stripe-signature");
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !whSecret) {
    return NextResponse.json({ ok: false, error: "Missing signature or secret" }, { status: 400 });
  }

  // --- Layer 1: verify the signature against the RAW body ---
  // If anyone but Stripe (with your webhook secret) sends this, it throws.
  let event;
  try {
    const rawBody = await req.text(); // raw text, NOT req.json()
    event = stripe.webhooks.constructEvent(rawBody, sig, whSecret);
  } catch (err) {
    return NextResponse.json({ ok: false, error: `Signature check failed: ${String(err)}` }, { status: 400 });
  }

  // Cards normally complete immediately. The second event covers payment
  // methods that confirm after the customer leaves Checkout.
  if (
    event.type !== "checkout.session.completed" &&
    event.type !== "checkout.session.async_payment_succeeded"
  ) {
    return NextResponse.json({ ok: true, ignored: event.type });
  }

  try {
    // Avoid external lookups for a webhook event that was already handled.
    const alreadyProcessed = await prisma.processedStripeEvent.findUnique({ where: { id: event.id } });
    if (alreadyProcessed) {
      return NextResponse.json({ ok: true, duplicate: event.id });
    }

    const session = event.data.object as Stripe.Checkout.Session;

    // Defense in depth: only grant if Stripe says it's actually paid.
    if (session.payment_status && session.payment_status !== "paid") {
      return NextResponse.json({ ok: true, note: "not paid", status: session.payment_status });
    }

    // --- Layer 3: resolve the Payment Link and the paying account ---
    const plan = await planFromCheckoutSession(session);
    const user = await userFromSession(session);
    const cfg = plan ? PAYMENT_PLANS[plan] : null;

    if (!user || !plan || !cfg) {
      return NextResponse.json({
        ok: true,
        note: "unmatched payment link or account",
        paymentLink: session.payment_link,
        email: session.customer_details?.email || session.customer_email || null,
      });
    }

    const access = accessForPurchase(user, plan);

    // Record the event and grant access atomically. If either write fails,
    // neither one is committed, so Stripe can safely retry the webhook.
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
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        err.code === "P2002"
      ) return NextResponse.json({ ok: true, duplicate: event.id });
      throw err;
    }

    return NextResponse.json({ ok: true, purchased: plan, granted: access.grantedPlan, user: user.id });
  } catch (err) {
    // 500 tells Stripe to retry later (transient DB issue, etc.).
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
