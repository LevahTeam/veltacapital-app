export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getUid } from "@/lib/getUid";
import { errorResponse, jsonResponse } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { accessForPurchase, planFromCheckoutSession } from "@/lib/stripeFulfillment";

const CHECKOUT_SESSION_ID = /^cs_[A-Za-z0-9_]+$/;

function checkoutEmail(session: Awaited<ReturnType<typeof stripe.checkout.sessions.retrieve>>) {
  return (session.customer_details?.email || session.customer_email || "").trim();
}

export async function POST(req: Request) {
  try {
    const uid = await getUid();
    if (!uid) return errorResponse("Not logged in", 401);

    const { sessionId } = (await req.json()) as { sessionId?: unknown };
    if (typeof sessionId !== "string" || !CHECKOUT_SESSION_ID.test(sessionId)) {
      return errorResponse("Invalid Checkout Session", 400);
    }

    const [session, user] = await Promise.all([
      stripe.checkout.sessions.retrieve(sessionId),
      prisma.user.findUnique({
        where: { id: uid },
        select: { id: true, email: true, plan: true, simRunsLeft: true },
      }),
    ]);
    if (!user) return errorResponse("Account not found", 404);
    if (session.payment_status !== "paid") {
      return errorResponse("Stripe has not confirmed payment", 409);
    }

    const paidBy = checkoutEmail(session);
    if (!paidBy || paidBy.toLowerCase() !== user.email.toLowerCase()) {
      return errorResponse("Checkout email does not match this account", 403);
    }
    if (session.client_reference_id && session.client_reference_id !== uid) {
      return errorResponse("Checkout belongs to a different account", 403);
    }

    const purchasedPlan = await planFromCheckoutSession(session);
    if (!purchasedPlan) {
      return errorResponse("Unrecognized VeltaCapital Payment Link", 400);
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

    return jsonResponse({ ok: true, ...access });
  } catch (err) {
    return errorResponse(String(err), 500);
  }
}
