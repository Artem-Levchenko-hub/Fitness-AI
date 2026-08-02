import { NextResponse } from "next/server";

/**
 * Совместимый ответ для старых оболочек. Refresh больше никогда не передаётся
 * JavaScript: токен существует только как HttpOnly cookie и ротируется на
 * server-side restore.
 */
export async function GET() {
  return NextResponse.json(
    { error: "refresh_tokens_are_http_only" },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
