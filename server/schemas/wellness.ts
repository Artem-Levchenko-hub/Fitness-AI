import { z } from "zod";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Неверная дата (YYYY-MM-DD)");
const notes = z
  .string()
  .max(500)
  .optional()
  .transform((value) => value?.trim() || null);

export const sleepLogSchema = z.object({
  date,
  hours: z.coerce.number().min(0).max(24),
  quality: z
    .union([z.coerce.number().int().min(1).max(5), z.literal("")])
    .optional()
    .transform((value) => (value === "" || value == null ? null : Number(value))),
  notes,
});

const optionalNumber = (max: number) =>
  z
    .union([z.coerce.number().min(0).max(max), z.literal("")])
    .optional()
    .transform((value) => (value === "" || value == null ? null : Number(value)));

export const nutritionEntrySchema = z.object({
  date,
  kcal: optionalNumber(10000).transform((value) => value == null ? null : Math.round(value)),
  proteinG: optionalNumber(1000),
  fatG: optionalNumber(1000),
  carbsG: optionalNumber(2000),
  notes,
});
