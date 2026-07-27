// ============================================================
//  GET /api/stats
//  Returns motivation-layer stats computed from the user's Score
//  rows: best (lowest) read error, and current consecutive-day
//  play streak. Read-only, server-computed.
// ============================================================
import { prisma } from "@/lib/prisma";
import { getUid } from "@/lib/getUid";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const uid = await getUid();
    if (!uid) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

    const scores = await prisma.score.findMany({
      where: { userId: uid },
      select: { accuracy: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    // Best read: highest accuracy maps to lowest error. accuracy is 0–100.
    // We report "best accuracy" directly; the UI phrases it.
    const bestAccuracy = scores.reduce((m, s) => Math.max(m, s.accuracy), 0);

    // Streak: count consecutive calendar days (user's local day is approximated
    // by UTC date here) with at least one score, ending today or yesterday.
    const daysPlayed = new Set(
      scores.map((s) => s.createdAt.toISOString().slice(0, 10)) // YYYY-MM-DD
    );
    let streak = 0;
    const day = new Date();
    // allow the streak to count if they played today OR yesterday (grace)
    const todayStr = day.toISOString().slice(0, 10);
    const yStr = new Date(day.getTime() - 86400000).toISOString().slice(0, 10);
    if (daysPlayed.has(todayStr) || daysPlayed.has(yStr)) {
      // walk backwards from today
      const cursor = daysPlayed.has(todayStr) ? new Date(day) : new Date(day.getTime() - 86400000);
      while (daysPlayed.has(cursor.toISOString().slice(0, 10))) {
        streak += 1;
        cursor.setTime(cursor.getTime() - 86400000);
      }
    }

    return NextResponse.json({
      ok: true,
      totalRounds: scores.length,
      bestAccuracy,
      streakDays: streak,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}