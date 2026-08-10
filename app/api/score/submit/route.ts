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
import {
  calculateVerifiedOptionOutcome,
  summarizePortfolio,
  type PortfolioRow,
} from "@/lib/simulationPortfolio";
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
    const symbol    = String(body.symbol || "Unknown").slice(0, 12);
    const accuracy  = Math.max(0, Math.min(100, Math.round(Number(body.accuracy) || 0)));
    const direction = body.direction ? 1 : 0;
    const roundIndex = Number(body.roundIndex);
    const optionType = body.optionType === "put" ? "put" : body.optionType === "call" ? "call" : null;
    if (!optionType) {
      return NextResponse.json({ ok: false, error: "Invalid option type" }, { status: 400 });
    }

    let optionOutcome;
    try {
      optionOutcome = calculateVerifiedOptionOutcome(roundIndex, optionType);
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid simulation round" }, { status: 400 });
    }
    if (symbol !== optionOutcome.symbol) {
      return NextResponse.json({ ok: false, error: "Round symbol mismatch" }, { status: 400 });
    }

    const creditAward =
      accuracy >= 90 ? 100 :
      accuracy >= 75 ? 50 :
      accuracy >= 50 ? 20 : 5;

    const { score, updated } = await prisma.$transaction(async (tx) => {
      const score = await tx.score.create({ data: { userId: uid, symbol, accuracy, direction } });
      await tx.$executeRaw`
        UPDATE "Score"
        SET "roundIndex" = ${optionOutcome.roundIndex},
            "optionType" = ${optionOutcome.optionType},
            "optionBudget" = ${optionOutcome.budget},
            "optionStrike" = ${optionOutcome.strike},
            "optionPremium" = ${optionOutcome.premium},
            "optionClosingPrice" = ${optionOutcome.closingPrice},
            "optionFinalValue" = ${optionOutcome.finalValue},
            "optionProfitLoss" = ${optionOutcome.profitLoss}
        WHERE "id" = ${score.id}
      `;
      const updated = await tx.user.update({
        where: { id: uid },
        data: {
          credits: { increment: creditAward },
          simRunsLeft: user.unlimitedSims ? undefined : { decrement: 1 },
          creditEvents: {
            create: { amount: creditAward, reason: "learning_round" },
          },
        },
      });
      return { score, updated };
    });
    const portfolioRows = await prisma.$queryRaw<PortfolioRow[]>`
      SELECT "optionBudget", "optionFinalValue", "optionProfitLoss"
      FROM "Score"
      WHERE "userId" = ${uid} AND "optionProfitLoss" IS NOT NULL
    `;
    const portfolio = summarizePortfolio(portfolioRows);

    return NextResponse.json({
      ok: true,
      scoreId: score.id,
      credits: updated.credits,
      earned: creditAward,
      optionOutcome,
      portfolio,
      simRunsLeft: updated.simRunsLeft,
      unlimitedSims: updated.unlimitedSims,
    });
  } catch (err) {
    return NextResponse.json({ ok:false, error:String(err) }, { status:500 });
  }
}
