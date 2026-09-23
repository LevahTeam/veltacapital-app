import { getUid } from "@/lib/getUid";
import { jsonResponse } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SavedGameState = {
  order: number[];
  ptr: number;
  sessionRounds: unknown[];
};

function isSavedGameState(value: unknown): value is SavedGameState {
  if (value === null || typeof value !== "object") return false;
  const candidate = value as Partial<SavedGameState>;
  const validOrder =
    Array.isArray(candidate.order) &&
    candidate.order.length <= 200 &&
    candidate.order.every((item) => Number.isInteger(item) && item >= 0);
  const validPointer = Number.isInteger(candidate.ptr) && Number(candidate.ptr) >= 0;
  const validRounds =
    Array.isArray(candidate.sessionRounds) && candidate.sessionRounds.length <= 50;
  return validOrder && validPointer && validRounds;
}

export async function POST(req: Request) {
  try {
    const uid = await getUid();
    if (!uid) return jsonResponse({ ok: false, anon: true });

    const { gameState } = (await req.json()) as { gameState?: unknown };
    if (!isSavedGameState(gameState)) {
      return jsonResponse({ ok: false, error: "Invalid game state" }, 400);
    }

    await prisma.$executeRaw`
      UPDATE "User"
      SET "gameState" = ${JSON.stringify(gameState)}::jsonb
      WHERE "id" = ${uid}
    `;
    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) }, 500);
  }
}

export async function GET() {
  try {
    const uid = await getUid();
    if (!uid) return jsonResponse({ ok: false, anon: true });

    const rows = await prisma.$queryRaw<Array<{ gameState: unknown }>>`
      SELECT "gameState"
      FROM "User"
      WHERE "id" = ${uid}
      LIMIT 1
    `;
    const gameState = rows.at(0)?.gameState ?? null;
    return jsonResponse({ ok: true, gameState });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) }, 500);
  }
}
