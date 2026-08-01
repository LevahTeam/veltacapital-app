// lib/isAdmin.ts
// Server-side admin check. Returns true ONLY if the logged-in user's email
// (read from the session via getUid, never from the client) matches the
// ADMIN_EMAIL environment variable. This is how "only Samuel can publish"
// is enforced — a normal logged-in user will not match.
import { prisma } from "@/lib/prisma";
import { getUid } from "@/lib/getUid";

export async function isAdmin(): Promise<boolean> {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return false; // no admin configured → nobody is admin

  const uid = await getUid();
  if (!uid) return false;

  const user = await prisma.user.findUnique({
    where: { id: uid },
    select: { email: true },
  });
  if (!user?.email) return false;

  // Case-insensitive compare, trimmed, to avoid trivial mismatches.
  return user.email.trim().toLowerCase() === adminEmail.trim().toLowerCase();
}
