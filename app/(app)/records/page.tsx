import { Trophy } from "lucide-react";
import type { Metadata } from "next";

import { ProfileTabs } from "@/components/profile/ProfileTabs";
import { requireUser } from "@/lib/auth/require-user";
import { localDateIso } from "@/lib/datetime/local-day";
import { summarizeStrengthRecords } from "@/lib/domain/strength-records";
import { getUserProfile } from "@/lib/repos/body.repo";
import { listStrengthRecords } from "@/lib/repos/strength-records.repo";

import { StrengthRecordsList } from "./records-list";

export const metadata: Metadata = { title: "Рекорды" };

export default async function RecordsPage() {
  const user = await requireUser();
  const [records, profile] = await Promise.all([
    listStrengthRecords(user.id),
    getUserProfile(user.id),
  ]);
  const summaries = summarizeStrengthRecords(records);
  const today = localDateIso(
    new Date(),
    profile?.timezone ?? "Europe/Moscow",
  );

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <header className="mb-5 flex items-center gap-4">
        <span className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-2xl">
          <Trophy className="size-6" aria-hidden="true" />
        </span>
        <div>
          <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
            Прогресс
          </p>
          <h1 className="font-serif mt-1 text-3xl font-normal tracking-tight md:text-4xl">
            Рекорды
          </h1>
        </div>
      </header>

      <ProfileTabs active="records" />

      <p className="text-muted-foreground mb-5 text-sm leading-relaxed">
        Три контрольных упражнения дают понятную картину силы. Нажмите на
        карточку, выполните тест по указанному стандарту и сохраните результат.
      </p>

      <StrengthRecordsList
        summaries={summaries}
        today={today}
      />
    </main>
  );
}
