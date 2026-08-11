import { z } from "zod";

import { STRENGTH_MOVEMENTS } from "@/db/schema/strength-records";

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

const strengthRecordBaseSchema = z
  .object({
    movement: z.enum(STRENGTH_MOVEMENTS),
    value: z.coerce.number().min(1),
    performedAt: z.string().regex(isoDate, "Укажите дату результата"),
  })
  .superRefine((record, ctx) => {
    const max = record.movement === "pull_up" ? 200 : 1000;
    if (record.value > max) {
      ctx.addIssue({
        code: "too_big",
        maximum: max,
        origin: "number",
        inclusive: true,
        message: `Максимальное значение — ${max}`,
        path: ["value"],
      });
    }
    if (record.movement === "pull_up" && !Number.isInteger(record.value)) {
      ctx.addIssue({
        code: "custom",
        message: "Количество повторений должно быть целым",
        path: ["value"],
      });
    }
    if (
      record.movement !== "pull_up" &&
      !Number.isInteger(record.value * 2)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Вес указывается с шагом 0,5 кг",
        path: ["value"],
      });
    }
  });

export function strengthRecordSchema(today: string) {
  return strengthRecordBaseSchema.superRefine((record, ctx) => {
    if (
      !isRealIsoDate(record.performedAt) ||
      record.performedAt < "2000-01-01"
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Проверьте дату результата",
        path: ["performedAt"],
      });
      return;
    }
    if (record.performedAt > today) {
      ctx.addIssue({
        code: "custom",
        message: "Дата результата не может быть в будущем",
        path: ["performedAt"],
      });
    }
  });
}

function isRealIsoDate(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year!, month! - 1, day!));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month &&
    parsed.getUTCDate() === day
  );
}

export const deleteStrengthRecordSchema = z.object({
  id: z.string().uuid(),
});
