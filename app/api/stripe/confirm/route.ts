export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getUid } from "@/lib/getUid";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { accessForPurchase, planFromCheckoutSession } from "@/lib/stripeFulfillment";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const uid = await getUid();
    if (!uid) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

    const { sessionId } = (await req.json()) as { sessionId?: unknown };
    if (typeof sessionId !== "string" || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
      return NextResponse.json({ ok: false, error: "Invalid Checkout Session" }, { status: 400 });
    }

    const [session, user] = await Promise.all([
      stripe.checkout.sessions.retrieve(sessionId),
      prisma.user.findUnique({
        where: { id: uid },
        select: { id: true, email: true, plan: true, simRunsLeft: true },
      }),
    ]);
    if (!user) return NextResponse.json({ ok: false, error: "Account not found" }, { status: 404 });
    if (session.payment_status !== "paid") {
      return NextResponse.json({ ok: false, error: "Stripe has not confirmed payment" }, { status: 409 });
    }

    const checkoutEmail = (session.customer_details?.email || session.customer_email || "").trim();
    if (!checkoutEmail || checkoutEmail.toLowerCase() !== user.email.toLowerCase()) {
      return NextResponse.json({ ok: false, error: "Checkout email does not match this account" }, { status: 403 });
    }
    if (session.client_reference_id && session.client_reference_id !== uid) {
      return NextResponse.json({ ok: false, error: "Checkout belongs to a different account" }, { status: 403 });
    }

    const purchasedPlan = await planFromCheckoutSession(session);
    if (!purchasedPlan) {
      return NextResponse.json({ ok: false, error: "Unrecognized VeltaCapital Payment Link" }, { status: 400 });
    }

    const access = accessForPurchase(user, purchasedPlan);
    await prisma.user.update({
      where: { id: uid },
      data: {
        plan: access.grantedPlan,
        simRunsLeft: access.simRunsLeft,
        unlimitedSims: access.unlimitedSims,
        canRedeem: true,
        earnMult: 1.0,
      },
    });

    return NextResponse.json({ ok: true, ...access });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
