import { generateText } from "ai";

import { aiClient, COACH_MODEL, isAiConfigured } from "@/lib/ai/deepseek";
import { extractJson } from "@/lib/ai/trainer-parse";
import {
  buildRefinePrompt,
  refineTemplateRawSchema,
  sanitizeRefinedTemplate,
  TEMPLATE_REFINE_SYSTEM_INSTRUCTION,
  type RefineTemplateInput,
  type RefineTemplateResult,
} from "@/lib/domain/templates/template-refine";
import { withCircuitBreaker } from "@/lib/safety/circuit-breaker";

export { isAiConfigured };

const BREAKER = "ai-template-refine";
const TIMEOUT_MS = 45_000;

export class EmptyRefineError extends Error {
  constructor() {
    super(
      "Тренер не смог собрать улучшение из доступных упражнений. Попробуйте ещё раз.",
    );
    this.name = "EmptyRefineError";
  }
}

/** Оценивает и улучшает шаблон LLM-тренером с учётом комментария атлета. Slug-и
 *  валидируются против каталога (выдуманные — выкидываются санитайзером). Кидает
 *  при пустом результате/сбое — оборачивайте в try/catch (R-32/33). */
export async function refineTemplate(
  input: RefineTemplateInput,
): Promise<RefineTemplateResult> {
  const validSlugs = new Set(input.catalog.map((c) => c.slug));

  const raw = await withCircuitBreaker(BREAKER, async () => {
    const result = await generateText({
      model: aiClient(COACH_MODEL),
      system: TEMPLATE_REFINE_SYSTEM_INSTRUCTION,
      prompt: buildRefinePrompt(input),
      temperature: 0.4,
      abortSignal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const text = result.text ?? "";
    if (!text.trim()) throw new Error("LLM вернул пустой ответ");
    return refineTemplateRawSchema.parse(JSON.parse(extractJson(text)));
  });

  const refined = sanitizeRefinedTemplate(raw, validSlugs);
  if (!refined) throw new EmptyRefineError();
  return refined;
}
