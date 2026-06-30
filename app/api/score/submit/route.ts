// ============================================================
//  POST /api/score/submit
//  body: { symbol, accuracy, direction, credits }
//  Saves one played round for the logged-in user and adds the
//  earned credits to their database balance (with an audit row).
//
//  NOTE (Option B): scoring still happens in the browser for now,
//  so `accuracy`/`credits` are trusted from the client. The
//  anti-cheat phase will move scoring here and stop trusting the
//  client. A basic sanity clamp is applied below to limit abuse.
// ============================================================
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const uid = cookieStore.get("velta_uid")?.value;
    if (!uid) {
      return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });
    }

    const body = await req.json();
    const symbol = String(body.symbol || "—").slice(0, 12);
    // clamp values to sane ranges so a tampered client can't send wild numbers
    const accuracy = Math.max(0, Math.min(100, Math.round(Number(body.accuracy) || 0)));
    const direction = body.direction ? 1 : 0;
    const credits = Math.max(0, Math.min(200, Math.round(Number(body.credits) || 0)));

    // save the score, add credits, and log the credit event — all at once
    const [score, user] = await prisma.$transaction([
      prisma.score.create({
        data: { userId: uid, symbol, accuracy, direction },
      }),
      prisma.user.update({
        where: { id: uid },
        data: {
          credits: { increment: credits },
          creditEvents: credits
            ? { create: { amount: credits, reason: "round_reward" } }
            : undefined,
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      scoreId: score.id,
      credits: user.credits, // new balance
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
