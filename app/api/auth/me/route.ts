import { jsonResponse } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { getUid } from "@/lib/getUid";

function publicUser(user: NonNullable<Awaited<ReturnType<typeof prisma.user.findUnique>>>) {
  const {
    id,
    email,
    name,
    credits,
    agreedToTermsAt,
    hasBadge,
  } = user;
  return {
    id,
    email,
    name,
    credits,
    agreedToTermsAt,
    hasBadge,
  };
}

export async function GET() {
  try {
    const uid = await getUid();
    if (!uid) return jsonResponse({ ok: true, user: null });

    const user = await prisma.user.findUnique({ where: { id: uid } });
    if (!user) return jsonResponse({ ok: true, user: null });

    return jsonResponse({ ok: true, user: publicUser(user) });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) }, 500);
  }
}
