import { z } from "zod";

import * as schema from "@/db/schema";

const muscleKeyEnum = z.enum(schema.muscleGroupKey.enumValues);

export const exerciseInputSchema = z
  .object({
    nameRu: z
      .string()
      .trim()
      .min(2, "Название (рус) — минимум 2 символа")
      .max(80, "Слишком длинное название"),
    nameEn: z
      .string()
      .trim()
      .min(2, "Название (англ) — минимум 2 символа")
      .max(80, "Слишком длинное название"),
    description: z
      .string()
      .trim()
      .max(2000, "Описание длиннее 2000 символов")
      .optional()
      .transform((v) => (v === "" ? undefined : v)),
    primary: z
      .array(muscleKeyEnum)
      .min(1, "Укажите хотя бы одну основную группу мышц")
      .max(4, "Слишком много основных групп"),
    secondary: z.array(muscleKeyEnum).max(6).default([]),
  })
  .refine(
    (data) => {
      const overlap = data.primary.filter((p) =>
        data.secondary.includes(p),
      );
      return overlap.length === 0;
    },
    { message: "Группа не может быть одновременно основной и вторичной" },
  );

export type ExerciseFormValues = z.input<typeof exerciseInputSchema>;
