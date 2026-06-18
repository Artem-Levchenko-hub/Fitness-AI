import { generateText } from "ai";

import { aiClient, COACH_MODEL, isAiConfigured } from "@/lib/ai/deepseek";
import { extractJson } from "@/lib/ai/trainer-parse";
import {
  aiPlanRawSchema,
  buildPlanComposerPrompt,
  PLAN_SYSTEM_INSTRUCTION,
  sanitizeAiPlan,
  type AiPlan,
  type PlanCatalogEntry,
  type PlanIntake,
} from "@/lib/domain/programs/ai-plan";
import { withCircuitBreaker } from "@/lib/safety/circuit-breaker";

export { isAiConfigured };

/** Имя breaker-а композера — отдельный от тренера/коуча, чтобы сбой генерации
 *  плана не открывал breaker анализов и наоборот. */
const BREAKER = "ai-plan-composer";
const TIMEOUT_MS = 45_000;

export class EmptyPlanError extends Error {
  constructor() {
    super("Тренер не смог собрать план из доступных упражнений. Попробуйте ещё раз.");
    this.name = "EmptyPlanError";
  }
}

/** Составляет персональный план LLM-тренером по ответам клиента и каталогу
 *  системных упражнений. Slug-и валидируются против каталога (выдуманные —
 *  выкидываются санитайзером). Кидает при пустом результате/сбое — оборачивайте
 *  в try/catch на стороне экшена (R-32/33: timeout + circuit breaker). */
export async function composeAiPlan(args: {
  intake: PlanIntake;
  catalog: PlanCatalogEntry[];
}): Promise<AiPlan> {
  const { intake, catalog } = args;
  const validSlugs = new Set(catalog.map((c) => c.slug));

  const raw = await withCircuitBreaker(BREAKER, async () => {
    const result = await generateText({
      model: aiClient(COACH_MODEL),
      system: PLAN_SYSTEM_INSTRUCTION,
      prompt: buildPlanComposerPrompt(intake, catalog),
      temperature: 0.5,
      abortSignal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const text = result.text ?? "";
    if (!text.trim()) throw new Error("LLM вернул пустой ответ");
    return aiPlanRawSchema.parse(JSON.parse(extractJson(text)));
  });

  const plan = sanitizeAiPlan(raw, validSlugs);
  if (!plan) throw new EmptyPlanError();
  return plan;
}
