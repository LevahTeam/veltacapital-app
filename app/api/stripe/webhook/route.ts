// ============================================================
//  POST /api/stripe/webhook
//  Stripe calls this after a payment. This is the ONLY place a plan is
//  granted. Three safety layers:
//   1) Signature check: proves the request is really from Stripe.
//   2) Idempotency: a repeated event cannot grant a plan twice.
//   3) Metadata lookup: identifies the buyer without a browser session.
//  File location: app/api/stripe/webhook/route.ts
// ============================================================
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

// Stripe must read the RAW request body to verify the signature, so we
// disable any body parsing/caching for this route.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Every public tier can earn non-cash learning credits. No tier receives a
// score multiplier or ranking advantage for paying more.
const PLANS: Record<string, { runs: number; unlimited: boolean }> = {
  trial: { runs: 5, unlimited: false },
  starter: { runs: 15, unlimited: false },
  standard: { runs: 50, unlimited: false },
  premium: { runs: 0, unlimited: true },
};

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

  // We only care about completed checkouts for now.
  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ ok: true, ignored: event.type });
  }

  try {
    // --- Layer 2: idempotency ---
    // Stripe may deliver the same event more than once. Record processed
    // event ids; if we've seen this one, do nothing. `create` throws on a
    // duplicate id (unique key), which we treat as "already handled".
    try {
      await prisma.processedStripeEvent.create({ data: { id: event.id } });
    } catch {
      return NextResponse.json({ ok: true, duplicate: event.id });
    }

    const session = event.data.object as Stripe.Checkout.Session;

    // Defense in depth: only grant if Stripe says it's actually paid.
    if (session.payment_status && session.payment_status !== "paid") {
      return NextResponse.json({ ok: true, note: "not paid", status: session.payment_status });
    }

    // --- Layer 3: read the buyer + plan from the metadata we stamped ---
    const uid  = session.metadata?.userId;
    const plan = session.metadata?.plan;
    const cfg = plan ? PLANS[plan] : undefined;

    if (!uid || !cfg) {
      // Nothing we can safely grant. 200 so Stripe doesn't keep retrying a
      // fundamentally un-actionable event, but we log the reason.
      return NextResponse.json({ ok: true, note: "missing/invalid metadata", uid, plan });
    }

    // --- Grant the plan (same logic as the original plan/set route) ---
    await prisma.user.update({
      where: { id: uid },
      data: {
        plan,
        simRunsLeft: cfg.runs,
        unlimitedSims: cfg.unlimited,
        canRedeem: true,
        earnMult: 1.0,
      },
    });

    return NextResponse.json({ ok: true, granted: plan, user: uid });
  } catch (err) {
    // 500 tells Stripe to retry later (transient DB issue, etc.).
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
