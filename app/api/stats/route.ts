import { getUid } from "@/lib/getUid";
import { errorResponse, jsonResponse } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const DAY_IN_MS = 86_400_000;

function utcDay(value: Date) {
  return value.toISOString().slice(0, 10);
}

function consecutiveDays(dates: Date[], now = new Date()) {
  const played = new Set(dates.map(utcDay));
  const today = utcDay(now);
  const yesterdayDate = new Date(now.getTime() - DAY_IN_MS);
  const yesterday = utcDay(yesterdayDate);
  if (!played.has(today) && !played.has(yesterday)) return 0;

  const cursor = played.has(today) ? new Date(now) : yesterdayDate;
  let count = 0;
  while (played.has(utcDay(cursor))) {
    count += 1;
    cursor.setTime(cursor.getTime() - DAY_IN_MS);
  }
  return count;
}

export async function GET() {
  try {
    const uid = await getUid();
    if (!uid) return errorResponse("Not logged in", 401);

    const scores = await prisma.score.findMany({
      where: { userId: uid },
      select: { accuracy: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    const bestAccuracy = scores.reduce(
      (best, score) => Math.max(best, score.accuracy),
      0
    );

    return jsonResponse({
      ok: true,
      totalRounds: scores.length,
      bestAccuracy,
      streakDays: consecutiveDays(scores.map(({ createdAt }) => createdAt)),
    });
  } catch (err) {
    return errorResponse(String(err), 500);
  }
}
