// ============================================================
//  POST /api/score/submit
//  body: { symbol, accuracy, direction, meanErrPct }
//  Consumes one simulation run, records the exercise result, and awards a
//  small amount of non-cash learning credit. Until scoring is recomputed from
//  server-owned chart data, the submitted score is bounded but not suitable
//  for prizes, cash value, or public competition.
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

    const creditAward =
      accuracy >= 90 ? 100 :
      accuracy >= 75 ? 50 :
      accuracy >= 50 ? 20 : 5;

    const [score, updated] = await prisma.$transaction([
      prisma.score.create({ data: { userId: uid, symbol, accuracy, direction } }),
      prisma.user.update({
        where: { id: uid },
        data: {
          credits: { increment: creditAward },
          simRunsLeft: user.unlimitedSims ? undefined : { decrement: 1 },
          creditEvents: {
            create: { amount: creditAward, reason: "learning_round" },
          },
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      scoreId: score.id,
      credits: updated.credits,
      earned: creditAward,
      simRunsLeft: updated.simRunsLeft,
      unlimitedSims: updated.unlimitedSims,
    });
  } catch (err) {
    return NextResponse.json({ ok:false, error:String(err) }, { status:500 });
  }
}
