import { getUid } from "@/lib/getUid";
import { errorResponse, jsonResponse } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import {
  calculateVerifiedOptionOutcome,
  summarizePortfolio,
  type PortfolioRow,
} from "@/lib/simulationPortfolio";

type ScoreSubmission = {
  symbol?: unknown;
  accuracy?: unknown;
  direction?: unknown;
  roundIndex?: unknown;
  optionType?: unknown;
};

function boundedAccuracy(value: unknown) {
  const rounded = Math.round(Number(value) || 0);
  return Math.min(100, Math.max(0, rounded));
}

function creditsForAccuracy(accuracy: number) {
  if (accuracy >= 90) return 100;
  if (accuracy >= 75) return 50;
  if (accuracy >= 50) return 20;
  return 5;
}

function optionTypeFrom(value: unknown) {
  if (value === "call" || value === "put") return value;
  return null;
}

export async function POST(req: Request) {
  try {
    const uid = await getUid();
    if (!uid) return errorResponse("Not logged in", 401);

    const user = await prisma.user.findUnique({ where: { id: uid } });
    if (!user) return errorResponse("No user", 404);

    if (!user.unlimitedSims && user.simRunsLeft <= 0) {
      return jsonResponse(
        { ok: false, error: "out_of_runs", message: "You're out of simulation runs." },
        402
      );
    }

    const body = (await req.json()) as ScoreSubmission;
    const symbol = String(body.symbol || "Unknown").slice(0, 12);
    const accuracy = boundedAccuracy(body.accuracy);
    const direction = body.direction ? 1 : 0;
    const roundIndex = Number(body.roundIndex);
    const optionType = optionTypeFrom(body.optionType);
    if (!optionType) {
      return errorResponse("Invalid option type", 400);
    }

    let optionOutcome;
    try {
      optionOutcome = calculateVerifiedOptionOutcome(roundIndex, optionType);
    } catch {
      return errorResponse("Invalid simulation round", 400);
    }
    if (symbol !== optionOutcome.symbol) {
      return errorResponse("Round symbol mismatch", 400);
    }

    const creditAward = creditsForAccuracy(accuracy);

    const { score, updated } = await prisma.$transaction(async (tx) => {
      const newScore = await tx.score.create({
        data: { userId: uid, symbol, accuracy, direction },
      });
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
        WHERE "id" = ${newScore.id}
      `;
      const updatedUser = await tx.user.update({
        where: { id: uid },
        data: {
          credits: { increment: creditAward },
          simRunsLeft: user.unlimitedSims ? undefined : { decrement: 1 },
          creditEvents: {
            create: { amount: creditAward, reason: "learning_round" },
          },
        },
      });
      return { score: newScore, updated: updatedUser };
    });
    const portfolioRows = await prisma.$queryRaw<PortfolioRow[]>`
      SELECT "optionBudget", "optionFinalValue", "optionProfitLoss"
      FROM "Score"
      WHERE "userId" = ${uid} AND "optionProfitLoss" IS NOT NULL
    `;
    return jsonResponse({
      ok: true,
      scoreId: score.id,
      credits: updated.credits,
      earned: creditAward,
      optionOutcome,
      portfolio: summarizePortfolio(portfolioRows),
      simRunsLeft: updated.simRunsLeft,
      unlimitedSims: updated.unlimitedSims,
    });
  } catch (err) {
    return errorResponse(String(err), 500);
  }
}
