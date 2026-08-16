import { getUid } from "@/lib/getUid";
import { errorResponse, jsonResponse } from "@/lib/http";
import { prisma } from "@/lib/prisma";

type Reward = {
  name: string;
  cost: number;
  kind?: "runs" | "feature";
  once?: boolean;
  ownedField?: "advancedUnlocked" | "hasBadge";
  apply: () => Record<string, unknown>;
};

const CATALOG: Record<string, Reward> = {
  extra_run: {
    name: "+1 historical-chart exercise",
    cost: 25,
    kind: "runs",
    apply: () => ({ simRunsLeft: { increment: 1 } }),
  },
  extra_runs: {
    name: "+5 historical-chart exercises",
    cost: 100,
    kind: "runs",
    apply: () => ({ simRunsLeft: { increment: 5 } }),
  },
  practice_pack: {
    name: "+15 historical-chart exercises",
    cost: 250,
    kind: "runs",
    apply: () => ({ simRunsLeft: { increment: 15 } }),
  },
  practice_bundle: {
    name: "+30 historical-chart exercises",
    cost: 450,
    kind: "runs",
    apply: () => ({ simRunsLeft: { increment: 30 } }),
  },
  mastery_pack: {
    name: "+60 historical-chart exercises",
    cost: 800,
    kind: "runs",
    apply: () => ({ simRunsLeft: { increment: 60 } }),
  },
  badge: {
    name: "Learning profile badge",
    cost: 300,
    kind: "feature",
    once: true,
    ownedField: "hasBadge",
    apply: () => ({ hasBadge: true }),
  },
  advanced_module: {
    name: "Advanced learning module",
    cost: 500,
    kind: "feature",
    once: true,
    ownedField: "advancedUnlocked",
    apply: () => ({ advancedUnlocked: true }),
  },
};

function unavailableRewardReason(
  reward: Reward,
  user: {
    plan: string;
    credits: number;
    unlimitedSims: boolean;
    advancedUnlocked: boolean;
    hasBadge: boolean;
  }
) {
  if (user.plan === "none") {
    return { error: "Course access is required for redemption.", status: 403 };
  }
  if (reward.kind === "runs" && user.unlimitedSims) {
    return {
      error: "Unlimited historical-chart exercises are already included with this plan.",
      status: 400,
    };
  }
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
      simRunsLeft: updated.simRunsLeft,
      advancedUnlocked: updated.advancedUnlocked,
      hasBadge: updated.hasBadge,
    });
  } catch (err) {
    return errorResponse(String(err), 500);
  }
}
