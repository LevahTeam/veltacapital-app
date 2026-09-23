import { prisma } from "@/lib/prisma";
import { getUid } from "@/lib/getUid";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export async function isAdmin(): Promise<boolean> {
  const configuredEmail = process.env.ADMIN_EMAIL;
  if (!configuredEmail) return false;

  const userId = await getUid();
  if (userId === null) return false;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  return user?.email
    ? normalizeEmail(user.email) === normalizeEmail(configuredEmail)
    : false;
}
