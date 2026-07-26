// ============================================================
//  POST /api/plan/set   body: { plan: "trial"|"starter"|"standard"|"premium" }
//  Sets the user's plan and grants that plan's simulation runs.
//
//  ⚠️ TEST-MODE ONLY. Any logged-in user can call this directly and
//  grant themselves any plan. Before Stripe goes live this must become
//  webhook-only and reject direct client calls.
// ============================================================
import { prisma } from "@/lib/prisma";
import { getUid } from "@/lib/getUid";
import { NextResponse } from "next/server";

const PLANS: Record<string, {credits:number; runs:number; unlimited:boolean; redeem:boolean; mult:number}> = {
  trial:    { credits: 0, runs: 5,  unlimited: false, redeem: false, mult: 1.0 },
  starter:  { credits: 0, runs: 15, unlimited: false, redeem: false, mult: 1.0 },
  standard: { credits: 0, runs: 50, unlimited: false, redeem: true,  mult: 1.0 },
  premium:  { credits: 0, runs: 0,  unlimited: true,  redeem: true,  mult: 1.5 },
};

export async function POST(req: Request) {
  try {
    const uid = await getUid();
    if (!uid) return NextResponse.json({ ok:false, error:"Not logged in" }, { status:401 });

    const { plan } = await req.json();
    const cfg = PLANS[plan];
    if (!cfg) return NextResponse.json({ ok:false, error:"Unknown plan" }, { status:400 });

    const user = await prisma.user.update({
      where: { id: uid },
      data: {
        plan,
        simRunsLeft:   { increment: cfg.runs },   // purchases stack
        unlimitedSims: cfg.unlimited,
        canRedeem:     cfg.redeem,
        earnMult:      cfg.mult,
        credits:       { increment: cfg.credits },
        creditEvents: cfg.credits
          ? { create: { amount: cfg.credits, reason: "purchase_grant" } }
          : undefined,
      },
    });

    return NextResponse.json({ ok:true, user: {
      id: user.id, email: user.email, name: user.name, plan: user.plan,
      credits: user.credits, simRunsLeft: user.simRunsLeft,
      unlimitedSims: user.unlimitedSims, canRedeem: user.canRedeem,
    }});
  } catch (err) {
    return NextResponse.json({ ok:false, error:String(err) }, { status:500 });
  }
}