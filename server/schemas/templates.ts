import { z } from "zod";

const templateItemSchema = z.object({
  exerciseId: z.string().uuid(),
  targetSets: z.coerce.number().int().min(1).max(20),
  targetRepsMin: z.coerce.number().int().min(1).max(100),
  targetRepsMax: z.coerce.number().int().min(1).max(100),
  targetWeightKg: z
    .union([z.coerce.number().min(0).max(1000), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v == null ? null : Number(v))),
  targetRestSeconds: z.coerce.number().int().min(15).max(900),
  /** Миорепсы: активационный подход + мини-сеты. Дефолты повторяют колонки БД —
   *  старые payload без этих полей остаются валидными (протокол выключен). */
  myoReps: z.coerce.boolean().default(false),
  myoMiniSets: z.coerce.number().int().min(1).max(10).default(4),
  myoMiniReps: z.coerce.number().int().min(1).max(10).default(4),
  myoMiniRestSeconds: z.coerce.number().int().min(5).max(60).default(15),
  notes: z
    .string()
    .max(500)
    .optional()
    .transform((v) => (v === "" ? null : (v ?? null))),
});

export const templateInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Название — минимум 2 символа")
    .max(80, "Слишком длинное название"),
  description: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v === "" ? null : (v ?? null))),
  items: z
    .array(templateItemSchema)
    .min(1, "Добавьте хотя бы одно упражнение")
    .max(30, "Слишком много упражнений в шаблоне"),
});

export type TemplateFormValues = z.input<typeof templateInputSchema>;
