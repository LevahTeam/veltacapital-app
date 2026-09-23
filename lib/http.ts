import { NextResponse } from "next/server";

export function jsonResponse<T>(payload: T, status?: number) {
  return status === undefined
    ? NextResponse.json(payload)
    : NextResponse.json(payload, { status });
}

export function errorResponse(error: string, status: number) {
  return jsonResponse({ ok: false, error }, status);
}
