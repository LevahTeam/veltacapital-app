import { getUid } from "@/lib/getUid";
import { errorResponse, jsonResponse } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { summarizePortfolio, type PortfolioRow } from "@/lib/simulationPortfolio";

type PortfolioRecord = PortfolioRow & {
  id: string;
  symbol: string;
  optionType: string | null;
  optionStrike: number | null;
  optionClosingPrice: number | null;
  createdAt: Date;
};

export async function GET() {
  try {
    const uid = await getUid();
    if (!uid) return errorResponse("Not logged in", 401);

    const [user, rows] = await Promise.all([
      prisma.user.findUnique({ where: { id: uid }, select: { name: true, email: true } }),
      prisma.$queryRaw<PortfolioRecord[]>`
        SELECT "id", "symbol", "optionType", "optionBudget", "optionStrike",
               "optionClosingPrice", "optionFinalValue", "optionProfitLoss", "createdAt"
        FROM "Score"
        WHERE "userId" = ${uid} AND "optionProfitLoss" IS NOT NULL
        ORDER BY "createdAt" DESC
      `,
    ]);
    if (!user) return errorResponse("User not found", 404);

    return jsonResponse({
      ok: true,
      ownerName: user.name || user.email || "VeltaCapital learner",
      summary: summarizePortfolio(rows),
      records: rows.slice(0, 50),
    });
  } catch (err) {
    return errorResponse(String(err), 500);
  }
}
