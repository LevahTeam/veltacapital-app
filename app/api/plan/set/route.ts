import { jsonResponse } from "@/lib/http";

export async function POST() {
  return jsonResponse(
    {
      ok: false,
      error:
        "Direct plan grants are disabled. Access can only be granted by a verified payment webhook or an audited admin operation.",
    },
    410
  );
}
