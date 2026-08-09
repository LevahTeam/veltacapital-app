import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      rows: [],
      error:
        "The competitive leaderboard is disabled. Results are kept as private learning feedback instead of public performance claims.",
    },
    { status: 410 }
  );
}
