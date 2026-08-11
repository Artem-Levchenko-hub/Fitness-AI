import { requireUser } from "@/lib/auth/require-user";
import { exchangeAiQuota } from "@/lib/repos/ai-quota.repo";

export const runtime = "nodejs";

export async function POST() {
  const user = await requireUser();
  const result = await exchangeAiQuota(user.id);

  if (result.kind === "subscription_required") {
    return Response.json({ error: result.kind }, { status: 403 });
  }
  if (result.kind === "insufficient_questions") {
    return Response.json(
      {
        error: result.kind,
        message: "Для обмена нужно сохранить 20 неиспользованных вопросов.",
        overview: result.overview,
      },
      { status: 409 },
    );
  }
  return Response.json({
    ok: true,
    exchanged: result.kind === "exchanged",
    overview: result.overview,
  });
}
