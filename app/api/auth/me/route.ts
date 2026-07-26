// ============================================================
//  GET /api/auth/me
//  Returns the currently logged-in user, read fresh from the DB.
//  Now backed by NextAuth (Google). Response shape unchanged,
//  so existing callers keep working.
// ============================================================
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getUid } from "@/lib/getUid";

export async function GET() {
  try {
    const uid = await getUid();
    if (!uid) return NextResponse.json({ ok: true, user: null });

    const user = await prisma.user.findUnique({ where: { id: uid } });
    if (!user) return NextResponse.json({ ok: true, user: null });

return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        credits: user.credits,
        simRunsLeft: user.simRunsLeft,
        unlimitedSims: user.unlimitedSims,
        canRedeem: user.canRedeem,
        agreedToTermsAt: user.agreedToTermsAt,
      },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
