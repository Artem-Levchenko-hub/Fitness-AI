import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { PushPrompt } from "@/components/push/PushPrompt";
import { env } from "@/lib/env";
import { requireUser } from "@/lib/auth/require-user";
import { getUserProfile } from "@/lib/repos/body.repo";
import { SignOutButton } from "@/components/auth/SignOutButton";

import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Профиль" };

export default async function SettingsPage() {
  const user = await requireUser();
  const profile = await getUserProfile(user.id);

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <header className="mb-6">
        <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
          Настройки
        </p>
        <h1 className="font-serif mt-1 text-3xl font-normal tracking-tight md:text-4xl">
          Профиль
        </h1>
      </header>

      <section className="bg-card text-card-foreground border-border mb-6 space-y-3 rounded-2xl border p-5">
        <div>
          <p className="text-muted-foreground text-xs">Email</p>
          <p className="text-sm font-medium">{user.email}</p>
        </div>
        {user.name ? (
          <div>
            <p className="text-muted-foreground text-xs">Имя</p>
            <p className="text-sm font-medium">{user.name}</p>
          </div>
        ) : null}
      </section>

      <section className="bg-card border-border mb-6 rounded-2xl border p-5">
        <h2 className="mb-4 text-sm font-semibold tracking-tight">
          Параметры тела
        </h2>
        <ProfileForm
          initialBirthDate={
            profile?.birthDate
              ? new Date(profile.birthDate).toISOString().slice(0, 10)
              : null
          }
          initialHeightCm={profile?.heightCm ?? null}
          initialSex={profile?.sex ?? null}
          initialWeightUnit={profile?.weightUnitPref ?? "kg"}
          initialExperience={profile?.experience ?? "intermediate"}
          initialTimezone={profile?.timezone ?? "Europe/Moscow"}
        />
        <p className="text-muted-foreground/70 mt-3 text-xs leading-relaxed">
          Эти данные AI-коуч учитывает при анализе. Замеры веса и обхваты
          добавляйте на странице{" "}
          <Link
            href="/body"
            className="text-primary underline-offset-4 hover:underline"
          >
            «Тело»
          </Link>
          .
        </p>
      </section>

      <section className="bg-card border-border mb-6 rounded-2xl border p-5">
        <h2 className="mb-3 text-sm font-semibold tracking-tight">
          Уведомления
        </h2>
        <PushPrompt vapidPublicKey={env.NEXT_PUBLIC_VAPID_PUBLIC_KEY} />
        <p className="text-muted-foreground/70 mt-2 text-xs leading-relaxed">
          Включите, чтобы тренер мог напомнить записать сон или КБЖУ и
          присылать готовые разборы.
        </p>
      </section>

      <section className="bg-card border-border mb-6 rounded-2xl border p-5">
        <h2 className="mb-2 text-sm font-semibold tracking-tight">
          Связанные разделы
        </h2>
        <div className="space-y-2">
          <Button
            asChild
            variant="ghost"
            className="text-foreground h-auto w-full justify-start py-3"
          >
            <Link href="/sleep" className="flex items-center justify-between">
              <span>Сон (восстановление)</span>
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            className="text-foreground h-auto w-full justify-start py-3"
          >
            <Link
              href="/nutrition"
              className="flex items-center justify-between"
            >
              <span>Питание (КБЖУ)</span>
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            className="text-foreground h-auto w-full justify-start py-3"
          >
            <Link href="/body" className="flex items-center justify-between">
              <span>Замеры тела (вес, % жира, обхваты)</span>
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            className="text-foreground h-auto w-full justify-start py-3"
          >
            <Link href="/billing" className="flex items-center justify-between">
              <span>Баланс и пополнение</span>
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            className="text-foreground h-auto w-full justify-start py-3"
          >
            <Link href="/stats" className="flex items-center justify-between">
              <span>Статистика и графики</span>
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>

      <SignOutButton />
    </main>
  );
}
