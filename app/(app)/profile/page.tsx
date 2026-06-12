import { Settings } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ProfileAvatar } from "@/components/avatar/ProfileAvatar";
import {
  buildAvatarData,
  hasTrainingData,
} from "@/components/avatar/build-avatar-data";
import { requireUser } from "@/lib/auth/require-user";
import { getLatestMeasurement, getUserProfile } from "@/lib/repos/body.repo";
import {
  muscleGroupRecords,
  muscleHeatProfile,
  muscleLastTrained,
} from "@/lib/repos/stats.repo";

export const metadata: Metadata = { title: "Профиль" };

export default async function ProfilePage() {
  const user = await requireUser();
  const now = new Date();

  const [heat, records, lastTrained, profile, measurement] = await Promise.all([
    muscleHeatProfile(user.id, now),
    muscleGroupRecords(user.id),
    muscleLastTrained(user.id),
    getUserProfile(user.id),
    getLatestMeasurement(user.id),
  ]);

  const data = buildAvatarData(heat, now, records, lastTrained);
  const hasData = hasTrainingData(heat);

  const displayName = user.name?.trim() || user.email;
  const heightCm = profile?.heightCm ?? null;
  const weightKg = measurement?.weightKg ?? null;

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
            Профиль
          </p>
          <h1 className="font-serif mt-1 truncate text-3xl font-normal tracking-tight md:text-4xl">
            {displayName}
          </h1>
        </div>
        <Link
          href="/settings"
          aria-label="Настройки"
          className="text-muted-foreground hover:text-foreground hover:bg-muted flex size-11 shrink-0 items-center justify-center rounded-full transition-colors"
        >
          <Settings className="size-5" />
        </Link>
      </header>

      {!hasData ? (
        <div className="border-border text-muted-foreground mb-4 rounded-2xl border border-dashed px-5 py-4 text-sm">
          Пока пусто. Заверши тренировку — и мышцы начнут гореть от серого к
          красному по объёму нагрузки.
        </div>
      ) : null}

      <ProfileAvatar data={data} linkExercises />

      <BodyMetrics heightCm={heightCm} weightKg={weightKg} />

      <p className="text-muted-foreground/70 mt-4 text-center text-xs leading-relaxed">
        Цвет мышцы — объём за 7 дней против твоей нормы: серый — отдыхает,
        красный — нагружена сильнее обычного. Покрути модель и нажимай на группы.
      </p>
    </main>
  );
}

function BodyMetrics({
  heightCm,
  weightKg,
}: {
  heightCm: number | null;
  weightKg: number | null;
}) {
  return (
    <dl className="mt-4 grid grid-cols-2 gap-3">
      <Metric
        label="Рост"
        value={heightCm != null ? `${heightCm} см` : "—"}
        href="/settings"
      />
      <Metric
        label="Вес"
        value={weightKg != null ? `${formatKg(weightKg)} кг` : "—"}
        href="/body"
      />
    </dl>
  );
}

function Metric({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="bg-card border-border hover:border-foreground/20 rounded-2xl border p-4 transition-colors"
    >
      <dt className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
        {label}
      </dt>
      <dd className="tabular mt-1 text-2xl font-semibold tracking-tight">
        {value}
      </dd>
    </Link>
  );
}

function formatKg(kg: number): string {
  return Number.isInteger(kg) ? String(kg) : kg.toFixed(1);
}
