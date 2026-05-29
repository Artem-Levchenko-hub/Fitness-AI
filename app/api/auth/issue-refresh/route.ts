import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { createRefreshToken } from "@/lib/auth/refresh";

/** Выдаёт долгоживущий refresh-токен текущему авторизованному пользователю.
 *  Клиент сохраняет его в localStorage — основной канал восстановления
 *  сессии в iOS PWA, где cookies могут стираться при suspend. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const token = await createRefreshToken(session.user.id);
  return NextResponse.json({ token });
}
