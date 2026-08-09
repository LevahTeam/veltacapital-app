import { prisma } from "@/lib/prisma";
import { getUid } from "@/lib/getUid";
import { NextResponse } from "next/server";

type Reward = {
  name: string;
  cost: number;
  once?: boolean;
  ownedField?: "advancedUnlocked" | "hasBadge";
  apply: () => Record<string, unknown>;
};

// Credits are an in-product learning counter. They cannot be purchased,
// transferred, redeemed for cash, or used as evidence of investing skill.
const CATALOG: Record<string, Reward> = {
  extra_runs: {
    name: "+5 historical-chart exercises",
    cost: 100,
    apply: () => ({ simRunsLeft: { increment: 5 } }),
  },
  badge: {
    name: "Learning profile badge",
    cost: 300,
    once: true,
    ownedField: "hasBadge",
    apply: () => ({ hasBadge: true }),
  },
  advanced_module: {
    name: "Advanced learning module",
    cost: 500,
    once: true,
    ownedField: "advancedUnlocked",
    apply: () => ({ advancedUnlocked: true }),
  },
};

export async function POST(req: Request) {
  try {
    const uid = await getUid();
    if (!uid) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

    const { rewardId } = await req.json();
    const reward = CATALOG[String(rewardId)];
    if (!reward) return NextResponse.json({ ok: false, error: "Unknown reward" }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { id: uid } });
    if (!user) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    if (user.plan === "none") {
      return NextResponse.json({ ok: false, error: "Course access is required for redemption." }, { status: 403 });
    }
    if (user.credits < reward.cost) {
      return NextResponse.json({ ok: false, error: "Not enough credits" }, { status: 400 });
    }
    if (reward.once && reward.ownedField && (user as Record<string, unknown>)[reward.ownedField]) {
      return NextResponse.json({ ok: false, error: "Already owned" }, { status: 400 });
    }

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

    return NextResponse.json({
      ok: true,
      credits: updated.credits,
      simRunsLeft: updated.simRunsLeft,
      advancedUnlocked: updated.advancedUnlocked,
      hasBadge: updated.hasBadge,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
