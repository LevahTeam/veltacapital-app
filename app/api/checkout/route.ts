// ============================================================
//  POST /api/checkout   body: { plan: "trial"|"starter"|"standard"|"premium" }
//  Creates a Stripe Checkout session for the given plan and returns its URL.
//  Grants NOTHING here — the plan is only granted in the webhook AFTER Stripe
//  confirms payment. This route just starts the payment.
//  File location: app/api/checkout/route.ts
// ============================================================
import { stripe, PRICE_IDS } from "@/lib/stripe";
import { getUid } from "@/lib/getUid";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    // Must be a logged-in user — getUid works here because this call comes
    // from the browser (with the session cookie), unlike the webhook.
    const uid = await getUid();
    if (!uid) {
      return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });
    }

    const { plan } = await req.json();
    const priceId = PRICE_IDS[plan];
    if (!priceId) {
      return NextResponse.json({ ok: false, error: "Unknown or unconfigured plan" }, { status: 400 });
    }

    // Look up the user's email to prefill Stripe's checkout (nicer UX, and
    // helps Stripe with receipts). Not required, but cheap and helpful.
    const user = await prisma.user.findUnique({
      where: { id: uid },
      select: { email: true },
    });

    // Where Stripe sends the user back to after paying / cancelling.
    // Uses your live domain in production, localhost in dev.
    const origin =
      req.headers.get("origin") ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "payment", // one-time payment (your plans are one-time, not subscriptions)
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: user?.email || undefined,

      // THIS is the crucial part: we stamp who is buying and what, so the
      // webhook can grant the right plan to the right user with no session.
      metadata: { userId: uid, plan },

      success_url: `${origin}/member.html?paid=1`,
      cancel_url: `${origin}/member.html?canceled=1`,
    });

    return NextResponse.json({ ok: true, url: session.url });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
