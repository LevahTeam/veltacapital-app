import { getUid } from "@/lib/getUid";
import { errorResponse, jsonResponse } from "@/lib/http";
import { prisma } from "@/lib/prisma";

type Reward = {
  name: string;
  cost: number;
  once?: boolean;
  ownedField?: "hasBadge";
  apply: () => Record<string, unknown>;
};

const CATALOG: Record<string, Reward> = {
  badge: {
    name: "Learning profile badge",
    cost: 300,
    once: true,
    ownedField: "hasBadge",
    apply: () => ({ hasBadge: true }),
  },
};

function unavailableRewardReason(
  reward: Reward,
  user: {
    credits: number;
    hasBadge: boolean;
  }
) {
  if (user.credits < reward.cost) {
    return { error: "Not enough credits", status: 400 };
  }
  if (reward.once && reward.ownedField && user[reward.ownedField]) {
    return { error: "Already owned", status: 400 };
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const uid = await getUid();
    if (!uid) return errorResponse("Not logged in", 401);

    const { rewardId } = (await req.json()) as { rewardId?: unknown };
    const reward = CATALOG[String(rewardId)];
    if (!reward) return errorResponse("Unknown reward", 400);

    const user = await prisma.user.findUnique({ where: { id: uid } });
    if (!user) return errorResponse("User not found", 404);

    const blocked = unavailableRewardReason(reward, user);
    if (blocked) return errorResponse(blocked.error, blocked.status);

    const [, , updated] = await prisma.$transaction([
      prisma.redemption.create({
        data: { userId: uid, rewardName: reward.name, creditCost: reward.cost },
      }),
      prisma.creditEvent.create({
        data: { userId: uid, amount: -reward.cost, reason: "learning_redemption" },
      }),
      prisma.user.update({
        where: { id: uid },
        data: { credits: { decrement: reward.cost }, ...reward.apply() },
      }),
    ]);

    return jsonResponse({
      ok: true,
      credits: updated.credits,
      hasBadge: updated.hasBadge,
    });
  } catch (err) {
    return errorResponse(String(err), 500);
  }
}
