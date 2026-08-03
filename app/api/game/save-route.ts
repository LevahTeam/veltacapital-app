// ============================================================
//  /api/game/save
//   POST → save the logged-in user's game position   body: { gameState }
//   GET  → return the logged-in user's saved game position
//  File location: app/api/game/save/route.ts
//
//  For anonymous trial players, getUid() is null → returns { ok:false,
//  anon:true }. The game treats that as "use localStorage instead."
// ============================================================
import { prisma } from "@/lib/prisma";
import { getUid } from "@/lib/getUid";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Save
export async function POST(req: Request) {
  try {
    const uid = await getUid();
    if (!uid) return NextResponse.json({ ok: false, anon: true });

    const { gameState } = await req.json();
    await prisma.user.update({
      where: { id: uid },
      data: { gameState: gameState ?? null },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// Load
export async function GET() {
  try {
    const uid = await getUid();
    if (!uid) return NextResponse.json({ ok: false, anon: true });

    const user = await prisma.user.findUnique({
      where: { id: uid },
      select: { gameState: true },
    });
    return NextResponse.json({ ok: true, gameState: user?.gameState ?? null });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
