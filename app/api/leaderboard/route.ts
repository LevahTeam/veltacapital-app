import { jsonResponse } from "@/lib/http";

export async function GET() {
  return jsonResponse(
    {
      ok: false,
      rows: [],
      error:
        "The competitive leaderboard is disabled. Results are kept as private learning feedback instead of public performance claims.",
    },
    410
  );
}
