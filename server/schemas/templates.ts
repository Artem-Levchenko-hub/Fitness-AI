import { z } from "zod";

import {
  DEFAULT_MYO_MINI_SETS,
  DEFAULT_MYO_FIRST_REST_SECONDS,
  DEFAULT_MYO_REPS_PERCENT,
  DEFAULT_MYO_REST_SECONDS,
  myoTotalSets,
  SET_SCHEMES,
} from "@/lib/domain/workouts/myo-reps";

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
  setScheme: z.enum(SET_SCHEMES).default("straight"),
  myoMiniSets: z.coerce
    .number()
    .int()
    .min(1)
    .max(5)
    .default(DEFAULT_MYO_MINI_SETS),
  myoRepsPercent: z.coerce
    .number()
    .int()
    .min(10)
    .max(50)
    .default(DEFAULT_MYO_REPS_PERCENT),
  myoRestSeconds: z.coerce
    .number()
    .int()
    .min(10)
    .max(60)
    .default(DEFAULT_MYO_REST_SECONDS),
  myoFirstRestSeconds: z.coerce
    .number()
    .int()
    .min(10)
    .max(90)
    .default(DEFAULT_MYO_FIRST_REST_SECONDS),
  notes: z
    .string()
    .max(500)
    .optional()
    .transform((v) => (v === "" ? null : (v ?? null))),
}).transform((item) => ({
  ...item,
  targetSets:
    item.setScheme === "myo_reps"
      ? myoTotalSets(item.myoMiniSets)
      : item.targetSets,
}));

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
