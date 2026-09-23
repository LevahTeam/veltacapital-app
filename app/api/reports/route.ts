import { errorResponse, jsonResponse } from "@/lib/http";
import { isAdmin } from "@/lib/isAdmin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ReportInput = {
  ticker?: unknown;
  title?: unknown;
  body?: unknown;
  published?: unknown;
};

function reportData(input: ReportInput) {
  if (!input.ticker || !input.title || !input.body) return null;
  return {
    ticker: String(input.ticker).toUpperCase().slice(0, 10),
    title: String(input.title).slice(0, 200),
    body: String(input.body),
    published: input.published !== false,
  };
}

export async function GET() {
  try {
    const admin = await isAdmin();
    const reports = await prisma.weeklyReport.findMany({
      where: admin ? {} : { published: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, ticker: true, title: true, body: true, published: true, createdAt: true },
    });
    return jsonResponse({ ok: true, reports, admin });
  } catch (err) {
    return errorResponse(String(err), 500);
  }
}

export async function POST(req: Request) {
  try {
    if (!(await isAdmin())) return errorResponse("Not authorized", 403);

    const data = reportData((await req.json()) as ReportInput);
    if (data === null) {
      return errorResponse("ticker, title, and body are all required", 400);
    }

    const report = await prisma.weeklyReport.create({ data });

    return jsonResponse({ ok: true, report });
  } catch (err) {
    return errorResponse(String(err), 500);
  }
}

export async function DELETE(req: Request) {
  try {
    if (!(await isAdmin())) return errorResponse("Not authorized", 403);

    const reportId = new URL(req.url).searchParams.get("id");
    if (!reportId) return errorResponse("Missing report id", 400);

    await prisma.weeklyReport.delete({ where: { id: reportId } });
    return jsonResponse({ ok: true, deleted: reportId });
  } catch (err) {
    return errorResponse(String(err), 500);
  }
}
