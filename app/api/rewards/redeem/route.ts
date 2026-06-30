// ============================================================
//  POST /api/rewards/redeem   body: { rewardName, creditCost }
//  Spends credits from the user's database balance for a reward,
//  records the redemption, and logs the credit event. Refuses if
//  the user doesn't have enough credits (checked server-side, so
//  it can't be faked).
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

    const { rewardName, creditCost } = await req.json();
    const cost = Math.max(0, Math.round(Number(creditCost) || 0));
    const name = String(rewardName || "Reward").slice(0, 60);

    // read current balance
    const user = await prisma.user.findUnique({ where: { id: uid } });
    if (!user) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });

    if (user.credits < cost) {
      return NextResponse.json(
        { ok: false, error: "Not enough credits" },
        { status: 400 }
      );
    }

    // spend credits, record redemption + audit event together
    const [, , updated] = await prisma.$transaction([
      prisma.redemption.create({
        data: { userId: uid, rewardName: name, creditCost: cost },
      }),
      prisma.creditEvent.create({
        data: { userId: uid, amount: -cost, reason: "redemption" },
      }),
      prisma.user.update({
        where: { id: uid },
        data: { credits: { decrement: cost } },
      }),
    ]);

    return NextResponse.json({ ok: true, credits: updated.credits });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
