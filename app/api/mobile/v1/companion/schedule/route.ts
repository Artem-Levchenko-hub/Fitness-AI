import { revalidatePath } from "next/cache";
import { z } from "zod";

import { listRecentCardio } from "@/lib/repos/cardio.repo";
import { listCircuits } from "@/lib/repos/circuits.repo";
import { createSchedule, deleteSchedule, listSchedules, setScheduleEnabled, type SchedulePresetLink } from "@/lib/repos/schedule.repo";
import { listTemplates } from "@/lib/repos/templates.repo";
import { formatDays, formatHour, WEEKDAYS } from "@/lib/ui/weekdays";
import { scheduleSchema } from "@/server/schemas/schedule";

import { accountIdSchema, companionJson, companionMutation, entityIdSchema, withCompanionUser } from "../response";

export const dynamic = "force-dynamic";

const mutation = z.discriminatedUnion("action", [
  scheduleSchema.extend({
    accountId: accountIdSchema, action: z.literal("create"),
    daysOfWeek: z.preprocess(
      (value) => Array.isArray(value) && value.every((day) => typeof day === "number") ? value : undefined,
      scheduleSchema.shape.daysOfWeek,
    ),
    hour: z.preprocess((value) => typeof value === "number" ? value : undefined, scheduleSchema.shape.hour),
  }),
  z.object({ accountId: accountIdSchema, action: z.literal("toggle"), id: entityIdSchema, enabled: z.boolean() }),
  z.object({ accountId: accountIdSchema, action: z.literal("delete"), id: entityIdSchema }),
]);

function parsePreset(preset: string | undefined): SchedulePresetLink | null {
  if (!preset) return null;
  const separator = preset.indexOf(":");
  return { kind: preset.slice(0, separator) as SchedulePresetLink["kind"], id: preset.slice(separator + 1) };
}

export function GET() {
  return withCompanionUser(async (user) => {
    const [schedules, templates, circuits, cardio] = await Promise.all([
      listSchedules(user.id), listTemplates(user.id), listCircuits(user.id), listRecentCardio(user.id),
    ]);
    const presets = [
      ...templates.map(({ id, name }) => ({ value: "template:" + id, label: name, format: "Силовая" })),
      ...circuits.map(({ id, name }) => ({ value: "circuit:" + id, label: name, format: "Круговая" })),
      ...cardio.map(({ id, name }) => ({ value: "cardio:" + id, label: name, format: "Кардио" })),
    ];
    const presetNames = new Map(presets.map(({ value, label }) => [value, label]));
    return companionJson({
      accountId: user.id,
      weekdays: WEEKDAYS,
      presets,
      schedules: schedules.map(({ id, label, daysOfWeek, hour, enabled, templateId, circuitWorkoutId, cardioWorkoutId }) => {
        let presetLabel: string | null = null;
        if (templateId) presetLabel = presetNames.get("template:" + templateId) ?? "Силовая заготовка";
        else if (circuitWorkoutId) presetLabel = presetNames.get("circuit:" + circuitWorkoutId) ?? "Круговая";
        else if (cardioWorkoutId) presetLabel = presetNames.get("cardio:" + cardioWorkoutId) ?? "Кардио";
        return { id, label, daysLabel: formatDays(daysOfWeek), hourLabel: formatHour(hour), enabled, presetLabel };
      }),
    });
  });
}

export function POST(request: Request) {
  return companionMutation(request, mutation, async (user, input) => {
    let id: string;
    switch (input.action) {
      case "create": {
        const { label, daysOfWeek, hour, preset } = input;
        const created = await createSchedule(user.id, { label, daysOfWeek, hour, preset: parsePreset(preset) });
        id = created.id;
        break;
      }
      case "toggle":
        await setScheduleEnabled(user.id, input.id, input.enabled);
        id = input.id;
        break;
      case "delete":
        await deleteSchedule(user.id, input.id);
        id = input.id;
        break;
    }
    revalidatePath("/schedule");
    revalidatePath("/dashboard");
    return companionJson({ id }, input.action === "create" ? 201 : 200);
  });
}
