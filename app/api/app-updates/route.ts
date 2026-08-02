import { NextResponse } from "next/server";

import { APP_UPDATE_MANIFEST } from "@/lib/app-update";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(APP_UPDATE_MANIFEST, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
