import { prisma } from "@/lib/prisma";
import { getUid } from "@/lib/getUid";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type SavedGameState = {
  order: number[];
  ptr: number;
  sessionRounds: unknown[];
};

function isSavedGameState(value: unknown): value is SavedGameState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SavedGameState>;
  return (
    Array.isArray(candidate.order) &&
    candidate.order.length <= 200 &&
    candidate.order.every((item) => Number.isInteger(item) && item >= 0) &&
    Number.isInteger(candidate.ptr) &&
    Number(candidate.ptr) >= 0 &&
    Array.isArray(candidate.sessionRounds) &&
    candidate.sessionRounds.length <= 50
  );
}

export async function POST(req: Request) {
  try {
    const uid = await getUid();
    if (!uid) return NextResponse.json({ ok: false, anon: true });

    const { gameState } = await req.json();
    if (!isSavedGameState(gameState)) {
      return NextResponse.json({ ok: false, error: "Invalid game state" }, { status: 400 });
    }

    await prisma.$executeRaw`
      UPDATE "User"
      SET "gameState" = ${JSON.stringify(gameState)}::jsonb
      WHERE "id" = ${uid}
    `;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function GET() {
  try {
    const uid = await getUid();
    if (!uid) return NextResponse.json({ ok: false, anon: true });

    const rows = await prisma.$queryRaw<Array<{ gameState: unknown }>>`
      SELECT "gameState"
      FROM "User"
      WHERE "id" = ${uid}
      LIMIT 1
    `;
    return NextResponse.json({ ok: true, gameState: rows[0]?.gameState ?? null });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
