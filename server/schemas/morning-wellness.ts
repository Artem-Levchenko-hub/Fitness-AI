import { z } from "zod";

function optionalMetric(max: number, message: string) {
  return z.preprocess((value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed ? Number(trimmed.replace(",", ".")) : undefined;
  }, z.number().min(0, message).max(max, message).optional());
}

export const morningWellnessSchema = z.object({
  date: z.iso.date("Неверная дата"),
  hours: optionalMetric(24, "Укажите сон от 0 до 24 часов"),
  proteinG: optionalMetric(1000, "Укажите белок от 0 до 1000 г"),
}).refine((value) => value.hours !== undefined || value.proteinG !== undefined, {
  message: "Заполните хотя бы одно поле или пропустите сегодня",
});
