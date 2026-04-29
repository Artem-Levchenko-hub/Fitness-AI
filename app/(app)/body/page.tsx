import { Trash2 } from "lucide-react";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import {
  ageFromBirthDate,
  bmiCategory,
  calculateBmi,
  leanBodyMassKg,
} from "@/lib/domain/body/bmi";
import {
  getUserProfile,
  listMeasurements,
} from "@/lib/repos/body.repo";
import { deleteBodyMeasurementAction } from "@/server/actions/body";

import { BodyMeasurementForm } from "./body-form";

export const metadata: Metadata = { title: "Тело" };

export default async function BodyPage() {
  const user = await requireUser();
  const [profile, measurements] = await Promise.all([
    getUserProfile(user.id),
    listMeasurements(user.id, 60),
  ]);

  const latest = measurements[0];
  const bmi =
    latest?.weightKg && profile?.heightCm
      ? calculateBmi(latest.weightKg, profile.heightCm)
      : null;
  const lbm =
    latest?.weightKg && latest?.bodyFatPct
      ? leanBodyMassKg(latest.weightKg, latest.bodyFatPct)
      : null;
  const age =
    profile?.birthDate ? ageFromBirthDate(new Date(profile.birthDate)) : null;

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <header className="mb-6">
        <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
          Композиция и обхваты
        </p>
        <h1 className="font-serif mt-1 text-3xl font-normal tracking-tight md:text-4xl">
          Тело
        </h1>
      </header>

      {latest ? (
        <section className="bg-card border-border mb-6 rounded-2xl border p-5">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Последний замер ·{" "}
            {new Date(latest.measuredAt).toLocaleDateString("ru-RU", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </p>
          <div className="tabular mt-2 grid grid-cols-3 gap-3">
            {latest.weightKg ? (
              <Stat label="Вес" value={`${latest.weightKg.toFixed(1)} кг`} />
            ) : null}
            {latest.bodyFatPct ? (
              <Stat
                label="% жира"
                value={`${latest.bodyFatPct.toFixed(1)}%`}
              />
            ) : null}
            {bmi ? (
              <Stat
                label="BMI"
                value={`${bmi.toFixed(1)}`}
                hint={bmiCategoryLabel(bmiCategory(bmi))}
              />
            ) : null}
            {lbm ? (
              <Stat label="LBM" value={`${lbm.toFixed(1)} кг`} />
            ) : null}
            {age != null ? <Stat label="Возраст" value={`${age}`} /> : null}
            {profile?.heightCm ? (
              <Stat label="Рост" value={`${profile.heightCm} см`} />
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="bg-card border-border mb-8 rounded-2xl border p-5">
        <h2 className="mb-4 text-sm font-semibold tracking-tight">
          Новый замер
        </h2>
        <BodyMeasurementForm />
      </section>

      {measurements.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold tracking-tight">
            История ({measurements.length})
          </h2>
          <ul className="bg-card border-border divide-border divide-y rounded-xl border">
            {measurements.map((m) => (
              <li
                key={m.id}
                className="flex items-start justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="tabular text-sm font-medium">
                    {new Date(m.measuredAt).toLocaleDateString("ru-RU", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                  <p className="text-muted-foreground tabular mt-0.5 text-xs">
                    {[
                      m.weightKg ? `${m.weightKg.toFixed(1)} кг` : null,
                      m.bodyFatPct ? `${m.bodyFatPct.toFixed(1)}% жира` : null,
                      m.waistCm ? `талия ${m.waistCm.toFixed(0)}` : null,
                      m.armCm ? `бицепс ${m.armCm.toFixed(0)}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {m.notes ? (
                    <p className="text-muted-foreground/80 mt-1 text-xs italic">
                      {m.notes}
                    </p>
                  ) : null}
                </div>
                <form action={deleteBodyMeasurementAction}>
                  <input type="hidden" name="id" value={m.id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon"
                    aria-label="Удалить замер"
                    className="text-muted-foreground hover:text-destructive size-8"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
        {label}
      </p>
      <p className="tabular text-foreground mt-0.5 text-lg font-semibold">
        {value}
      </p>
      {hint ? (
        <p className="text-muted-foreground/80 text-[10px]">{hint}</p>
      ) : null}
    </div>
  );
}

function bmiCategoryLabel(c: ReturnType<typeof bmiCategory>): string {
  switch (c) {
    case "underweight":
      return "недовес";
    case "normal":
      return "норма";
    case "overweight":
      return "избыток";
    case "obese":
      return "ожирение";
  }
}
