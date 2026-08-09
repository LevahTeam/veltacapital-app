import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error:
        "Direct plan grants are disabled. Access can only be granted by a verified payment webhook or an audited admin operation.",
    },
    { status: 410 }
  );
}
