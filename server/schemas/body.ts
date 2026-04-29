import { z } from "zod";

const optNum = (max: number, min = 0) =>
  z
    .union([z.coerce.number().min(min).max(max), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v == null || v === "" ? null : Number(v)));

export const bodyMeasurementSchema = z
  .object({
    measuredAt: z
      .string()
      .optional()
      .transform((v) => (v ? new Date(v) : new Date())),
    weightKg: optNum(500, 20),
    bodyFatPct: optNum(70, 1),
    waistCm: optNum(300, 30),
    neckCm: optNum(100, 20),
    chestCm: optNum(200, 50),
    hipCm: optNum(250, 30),
    armCm: optNum(80, 15),
    thighCm: optNum(120, 20),
    notes: z
      .string()
      .max(500)
      .optional()
      .transform((v) => (v === "" ? null : (v ?? null))),
  })
  .refine(
    (d) =>
      d.weightKg != null ||
      d.bodyFatPct != null ||
      d.waistCm != null ||
      d.neckCm != null ||
      d.chestCm != null ||
      d.hipCm != null ||
      d.armCm != null ||
      d.thighCm != null,
    { message: "Заполните хотя бы одну метрику" },
  );

export const profileSchema = z.object({
  birthDate: z
    .string()
    .optional()
    .transform((v) => {
      if (!v) return null;
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    }),
  heightCm: z
    .union([z.coerce.number().int().min(100).max(250), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v == null ? null : Number(v))),
  sex: z
    .enum(["male", "female", "other", ""])
    .optional()
    .transform((v) => (v === "" || v == null ? null : v)),
  weightUnitPref: z.enum(["kg", "lb"]).default("kg"),
  experience: z
    .enum(["beginner", "intermediate", "advanced"])
    .default("intermediate"),
  timezone: z.string().min(1).default("Europe/Moscow"),
});

export type BodyMeasurementInput = z.input<typeof bodyMeasurementSchema>;
export type ProfileInput = z.input<typeof profileSchema>;
