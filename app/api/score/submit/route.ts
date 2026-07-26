// ============================================================
//  POST /api/score/submit
//  body: { symbol, accuracy, direction, meanErrPct }
//  Consumes one simulation run, computes credits server-side from
//  the reported mean error, and records the round.
//
//  Credits are NO LONGER trusted from the client — the server derives
//  them from meanErrPct and applies the plan's earn multiplier.
//  (meanErrPct itself is still client-reported; moving scoring fully
//  server-side is the remaining anti-cheat step.)
// ============================================================
import { prisma } from "@/lib/prisma";
import { getUid } from "@/lib/getUid";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const uid = await getUid();
    if (!uid) return NextResponse.json({ ok:false, error:"Not logged in" }, { status:401 });

    const user = await prisma.user.findUnique({ where: { id: uid } });
    if (!user) return NextResponse.json({ ok:false, error:"No user" }, { status:404 });

    // gate: must have runs left unless unlimited
    if (!user.unlimitedSims && user.simRunsLeft <= 0) {
      return NextResponse.json(
        { ok:false, error:"out_of_runs", message:"You're out of simulation runs." },
        { status: 402 }
      );
    }

    const body = await req.json();
    const symbol    = String(body.symbol || "—").slice(0, 12);
    const accuracy  = Math.max(0, Math.min(100, Math.round(Number(body.accuracy) || 0)));
    const direction = body.direction ? 1 : 0;

    // server decides credits from the reported average error
    const meanErr = Math.max(0, Number(body.meanErrPct) ?? 999);
    const band =
      meanErr <=  2 ? 100 :
      meanErr <=  5 ?  50 :
      meanErr <= 10 ?  20 :
      meanErr <= 20 ?   5 : 0;
    const credits = Math.round(band * (user.earnMult ?? 1));

    const [score, updated] = await prisma.$transaction([
      prisma.score.create({ data: { userId: uid, symbol, accuracy, direction } }),
      prisma.user.update({
        where: { id: uid },
        data: {
          credits: { increment: credits },
          simRunsLeft: user.unlimitedSims ? undefined : { decrement: 1 },
          creditEvents: credits
            ? { create: { amount: credits, reason: "round_reward" } }
            : undefined,
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      scoreId: score.id,
      credits: updated.credits,
      earned: credits,
      simRunsLeft: updated.simRunsLeft,
      unlimitedSims: updated.unlimitedSims,
    });
  } catch (err) {
    return NextResponse.json({ ok:false, error:String(err) }, { status:500 });
  }
}