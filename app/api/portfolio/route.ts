import { getUid } from "@/lib/getUid";
import { prisma } from "@/lib/prisma";
import { summarizePortfolio, type PortfolioRow } from "@/lib/simulationPortfolio";
import { NextResponse } from "next/server";

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
    if (!uid) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

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
    if (!user) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });

    const summary = summarizePortfolio(rows);
    return NextResponse.json({
      ok: true,
      ownerName: user.name || user.email || "VeltaCapital learner",
      summary,
      records: rows.slice(0, 50),
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
