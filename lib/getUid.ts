// ============================================================
//  getUid()
//  Returns the current user's id, or null if not logged in.
//  Drop-in replacement for the old velta_uid cookie read.
// ============================================================
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function getUid(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return (session?.user as any)?.id ?? null;
}
