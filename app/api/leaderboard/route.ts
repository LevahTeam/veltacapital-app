import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const uid = cookieStore.get("velta_uid")?.value || null;

    const grouped = await prisma.score.groupBy({
      by: ["userId"],
      _max: { accuracy: true },
      _count: { _all: true },
      orderBy: { _max: { accuracy: "desc" } },
      take: 20,
    });

    const ids = grouped.map((g: { userId: string }) => g.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });
    const nameById = new Map(users.map((u: { id: string; name: string | null }) => [u.id, u.name || "Anonymous"]));

    const rows = grouped.map((g: { userId: string; _max: { accuracy: number | null }; _count: { _all: number } }, i: number) => ({
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
