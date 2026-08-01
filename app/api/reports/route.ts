// ============================================================
//  /api/reports
//   GET    → list published reports (anyone). Admin sees all (incl. drafts).
//   POST   → create a report (ADMIN ONLY)
//   DELETE → delete a report (ADMIN ONLY)   ?id=<reportId>
//  File location: app/api/reports/route.ts
// ============================================================
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/isAdmin";
import { NextResponse } from "next/server";

// --- List reports ---
// Members see published only. When the admin is logged in, ALL reports are
// returned (including hidden drafts) so the admin list is complete.
export async function GET() {
  try {
    const admin = await isAdmin();
    const reports = await prisma.weeklyReport.findMany({
      where: admin ? {} : { published: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, ticker: true, title: true, body: true, published: true, createdAt: true },
    });
    return NextResponse.json({ ok: true, reports, admin });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// --- Admin only: create a report ---
export async function POST(req: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ ok: false, error: "Not authorized" }, { status: 403 });
    }

    const { ticker, title, body, published } = await req.json();
    if (!ticker || !title || !body) {
      return NextResponse.json(
        { ok: false, error: "ticker, title, and body are all required" },
        { status: 400 }
      );
    }

    const report = await prisma.weeklyReport.create({
      data: {
        ticker: String(ticker).toUpperCase().slice(0, 10),
        title: String(title).slice(0, 200),
        body: String(body),
        published: published !== false,
      },
    });

    return NextResponse.json({ ok: true, report });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// --- Admin only: delete a report ---
// Called as: DELETE /api/reports?id=<reportId>
export async function DELETE(req: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ ok: false, error: "Not authorized" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ ok: false, error: "Missing report id" }, { status: 400 });
    }

    await prisma.weeklyReport.delete({ where: { id } });
    return NextResponse.json({ ok: true, deleted: id });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
