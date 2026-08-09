import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error:
        "Reward redemption is disabled while VeltaCapital is being refocused on learning progress rather than prize incentives.",
    },
    { status: 410 }
  );
}
