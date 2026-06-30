// ============================================================
//  GET /api/leaderboard
//  Returns the top players, ranked by their BEST round accuracy,
//  with how many rounds they've played. Also flags which row is
//  the current logged-in user (so the UI can highlight "you").
// ============================================================
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const uid = cookieStore.get("velta_uid")?.value || null;

    // group scores by user: best accuracy + number of rounds
    const grouped = await prisma.score.groupBy({
      by: ["userId"],
      _max: { accuracy: true },
      _count: { _all: true },
      orderBy: { _max: { accuracy: "desc" } },
      take: 20,
    });

    // fetch the display names for those users
    const ids = grouped.map((g) => g.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });
    const nameById = new Map(users.map((u) => [u.id, u.name || "Anonymous"]));

    const rows = grouped.map((g, i) => ({
      rank: i + 1,
      name: nameById.get(g.userId) || "Anonymous",
      best: g._max.accuracy ?? 0,
      rounds: g._count._all,
      isYou: g.userId === uid,
    }));

    return NextResponse.json({ ok: true, rows });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
