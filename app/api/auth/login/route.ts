// ============================================================
//  POST /api/auth/login
//  Dev login: takes an email + name, creates the user if new
//  (or finds them if returning), and sets a login cookie.
//  This is the TEMPORARY stand-in for Google login. When real
//  Google auth is added, only this file changes — everything
//  built on top of it keeps working.
// ============================================================
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = (body.email || "").trim().toLowerCase();
    const name = (body.name || "").trim() || "New User";

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { ok: false, error: "Please enter a valid email." },
        { status: 400 }
      );
    }

    // find existing user, or create a new one
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: { email, name },
      });
    }

    // set a simple login cookie holding the user id.
    // (Dev-grade only. Real auth will sign/secure this properly.)
    const cookieStore = await cookies();
    cookieStore.set("velta_uid", user.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, name: user.name, plan: user.plan, credits: user.credits },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
