// ============================================================
//  GET /api/auth/me
//  Returns the currently logged-in user (read fresh from the
//  database, so plan/credits are always accurate). Returns
//  { user: null } if nobody is logged in.
// ============================================================
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const uid = cookieStore.get("velta_uid")?.value;
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
      },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
