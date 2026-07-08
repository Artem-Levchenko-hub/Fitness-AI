import { generateText } from "ai";

import { aiClient, COACH_MODEL, isAiConfigured } from "@/lib/ai/deepseek";
import { extractJson } from "@/lib/ai/trainer-parse";
import {
  buildProgramReviewPrompt,
  PROGRAM_REVIEW_SYSTEM_INSTRUCTION,
  programReviewRawSchema,
  sanitizeProgramReview,
  type ProgramReviewInput,
  type ProgramReviewResult,
} from "@/lib/domain/programs/program-review";
import { withCircuitBreaker } from "@/lib/safety/circuit-breaker";

export { isAiConfigured };

/** Отдельный breaker — сбой оценки программы не открывает breaker анализов/
 *  композера и наоборот. */
const BREAKER = "ai-program-review";
const TIMEOUT_MS = 45_000;

/** Оценивает тренировочную программу LLM-тренером. Кидает при пустом ответе/
 *  сбое — оборачивайте в try/catch на стороне экшена (R-32/33). */
export async function reviewProgram(
  input: ProgramReviewInput,
): Promise<ProgramReviewResult> {
  const raw = await withCircuitBreaker(BREAKER, async () => {
    const result = await generateText({
      model: aiClient(COACH_MODEL),
      system: PROGRAM_REVIEW_SYSTEM_INSTRUCTION,
      prompt: buildProgramReviewPrompt(input),
      temperature: 0.4,
      abortSignal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const text = result.text ?? "";
    if (!text.trim()) throw new Error("LLM вернул пустой ответ");
    return programReviewRawSchema.parse(JSON.parse(extractJson(text)));
  });

  return sanitizeProgramReview(raw);
}
