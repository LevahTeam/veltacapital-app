import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function getUid(): Promise<string | null> {
  const currentSession = await getServerSession(authOptions);
  const userId = currentSession?.user?.id;
  return typeof userId === "string" ? userId : null;
}
