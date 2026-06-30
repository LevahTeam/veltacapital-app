// ============================================================
//  POST /api/auth/logout
//  Clears the login cookie.
// ============================================================
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete("velta_uid");
  return NextResponse.json({ ok: true });
}
