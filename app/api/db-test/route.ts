import { prisma } from "@/lib/prisma";
import { jsonResponse } from "@/lib/http";

export async function GET() {
  try {
    const userCount = await prisma.user.count();
    return jsonResponse({
      ok: true,
      message: "Database connected successfully 🎉",
      userCount,
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) }, 500);
  }
}
