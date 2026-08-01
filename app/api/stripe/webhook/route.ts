// ============================================================
//  POST /api/stripe/webhook
//  Stripe calls this after a payment. This is the ONLY place a plan is
//  granted. Three safety layers:
//   1) Signature check  — proves the request is really from Stripe.
//   2) Idempotency      — a repeated event can't grant a plan twice.
//   3) Metadata lookup  — identifies the buyer without a browser session.
//  File location: app/api/stripe/webhook/route.ts
// ============================================================
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Stripe must read the RAW request body to verify the signature, so we
// disable any body parsing/caching for this route.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Same plan config as the original plan/set route — the grant logic is
// identical, it just runs here (after payment) instead of on direct call.
const PLANS: Record<string, {credits:number; runs:number; unlimited:boolean; redeem:boolean; mult:number}> = {
  trial:    { credits: 0, runs: 5,  unlimited: false, redeem: false, mult: 1.0 },
  starter:  { credits: 0, runs: 15, unlimited: false, redeem: false, mult: 1.0 },
  standard: { credits: 0, runs: 50, unlimited: false, redeem: true,  mult: 1.0 },
  premium:  { credits: 0, runs: 0,  unlimited: true,  redeem: true,  mult: 1.5 },
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

    const session = event.data.object as any;

    // Defense in depth: only grant if Stripe says it's actually paid.
    if (session.payment_status && session.payment_status !== "paid") {
      return NextResponse.json({ ok: true, note: "not paid", status: session.payment_status });
    }

    // --- Layer 3: read the buyer + plan from the metadata we stamped ---
    const uid  = session.metadata?.userId;
    const plan = session.metadata?.plan;
    const cfg  = PLANS[plan];

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
        simRunsLeft:   { increment: cfg.runs },
        unlimitedSims: cfg.unlimited,
        canRedeem:     cfg.redeem,
        earnMult:      cfg.mult,
        credits:       { increment: cfg.credits },
        creditEvents: cfg.credits
          ? { create: { amount: cfg.credits, reason: "purchase_grant" } }
          : undefined,
      },
    });

    return NextResponse.json({ ok: true, granted: plan, user: uid });
  } catch (err) {
    // 500 tells Stripe to retry later (transient DB issue, etc.).
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
