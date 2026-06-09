import { z } from "zod";

/** Расписание тренировки. daysOfWeek приходит из чекбоксов (formData.getAll),
 *  поэтому действие собирает массив строк вручную перед safeParse. */
export const scheduleSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "Укажите, что тренировать")
    .max(60, "Слишком длинно (макс. 60 символов)"),
  daysOfWeek: z
    .array(z.coerce.number().int().min(1).max(7))
    .min(1, "Выберите хотя бы один день")
    .transform((days) => Array.from(new Set(days)).sort((a, b) => a - b)),
  hour: z.coerce.number().int().min(0).max(23),
});

export type ScheduleInput = z.input<typeof scheduleSchema>;
export type ScheduleParsed = z.output<typeof scheduleSchema>;
