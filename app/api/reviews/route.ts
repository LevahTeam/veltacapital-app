import { getUid } from "@/lib/getUid";
import { errorResponse, jsonResponse } from "@/lib/http";
import { isAdmin } from "@/lib/isAdmin";
import { prisma } from "@/lib/prisma";
import { REVIEW_LIMITS, isReviewStatus, parseReview } from "@/lib/reviews";

export const dynamic = "force-dynamic";

const UNAVAILABLE = "Reviews are not available right now";

// Never add userId or email here: this shape is served to every visitor.
const PUBLIC_FIELDS = {
  id: true,
  displayName: true,
  rating: true,
  body: true,
  language: true,
  createdAt: true,
} as const;

export async function GET(req: Request) {
  try {
    if (new URL(req.url).searchParams.get("scope") === "moderation") {
      if (!(await isAdmin())) return errorResponse("Not authorized", 403);

      const reviews = await prisma.review.findMany({
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
        select: { ...PUBLIC_FIELDS, status: true },
      });
      return jsonResponse({ ok: true, reviews });
    }

    const reviews = await prisma.review.findMany({
      where: { status: "approved" },
      orderBy: { createdAt: "desc" },
      take: REVIEW_LIMITS.publicPage,
      select: PUBLIC_FIELDS,
    });

    const uid = await getUid();
    const mine = uid
      ? await prisma.review.findUnique({
          where: { userId: uid },
          select: { displayName: true, rating: true, body: true, status: true },
        })
      : null;

    return jsonResponse({ ok: true, reviews, signedIn: uid !== null, mine });
  } catch {
    return errorResponse(UNAVAILABLE, 503);
  }
}

export async function POST(req: Request) {
  try {
    const uid = await getUid();
    if (!uid) return jsonResponse({ ok: false, anon: true }, 401);

    const parsed = parseReview(await req.json().catch(() => null));
    if (!parsed.ok) return jsonResponse({ ok: false, problem: parsed.problem }, 400);

    const fields = { ...parsed.data, status: "pending", consentAt: new Date(), reviewedAt: null };
    const review = await prisma.review.upsert({
      where: { userId: uid },
      create: { userId: uid, ...fields },
      update: fields,
      select: { displayName: true, rating: true, body: true, status: true },
    });
    return jsonResponse({ ok: true, mine: review });
  } catch {
    return errorResponse(UNAVAILABLE, 503);
  }
}

export async function PATCH(req: Request) {
  try {
    if (!(await isAdmin())) return errorResponse("Not authorized", 403);

    const { id, status } = ((await req.json().catch(() => null)) ?? {}) as {
      id?: unknown;
      status?: unknown;
    };
    if (typeof id !== "string" || !isReviewStatus(status)) {
      return errorResponse("id and a valid status are required", 400);
    }

    const review = await prisma.review.update({
      where: { id },
      data: { status, reviewedAt: new Date() },
      select: { id: true, status: true },
    });
    return jsonResponse({ ok: true, review });
  } catch {
    return errorResponse(UNAVAILABLE, 503);
  }
}

// With ?id= an admin removes any review. Without it, a reader removes their own.
export async function DELETE(req: Request) {
  try {
    const reviewId = new URL(req.url).searchParams.get("id");
    if (reviewId) {
      if (!(await isAdmin())) return errorResponse("Not authorized", 403);
      await prisma.review.delete({ where: { id: reviewId } });
      return jsonResponse({ ok: true, deleted: reviewId });
    }

    const uid = await getUid();
    if (!uid) return jsonResponse({ ok: false, anon: true }, 401);
    await prisma.review.deleteMany({ where: { userId: uid } });
    return jsonResponse({ ok: true });
  } catch {
    return errorResponse(UNAVAILABLE, 503);
  }
}
