// ============================================================
//  POST /api/plan/set   body: { plan: "basic" | "pro" | "investor" }
//  Sets the logged-in user's plan and grants the plan's starting
//  credits — recording a CreditEvent for the audit trail.
//
//  This is the TEST-MODE stand-in for Stripe. When real payments
//  are added, Stripe's webhook will call this same logic after a
//  confirmed payment. For now it just sets the plan directly so we
//  can build and test the member experience without money.
// ============================================================
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// starting credits per plan (kept in sync with the front-end PLANS)
const START_CREDITS: Record<string, number> = {
  basic: 0,
  pro: 2500,
  investor: 8000,
};

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const uid = cookieStore.get("velta_uid")?.value;
    if (!uid) {
      return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });
    }

    const { plan } = await req.json();
    if (!["basic", "pro", "investor"].includes(plan)) {
      return NextResponse.json({ ok: false, error: "Unknown plan" }, { status: 400 });
    }

    const grant = START_CREDITS[plan] ?? 0;

    // update plan + add starting credits, and log the credit event
    const user = await prisma.user.update({
      where: { id: uid },
      data: {
        plan,
        credits: { increment: grant },
        creditEvents: grant
          ? { create: { amount: grant, reason: "purchase_grant" } }
          : undefined,
      },
    });

    return NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, name: user.name, plan: user.plan, credits: user.credits },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
