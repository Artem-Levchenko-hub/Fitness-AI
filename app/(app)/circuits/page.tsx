import {
  ChevronRight,
  Layers,
  Play,
  Plus,
  Repeat,
  Timer,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import {
  getActiveCircuitId,
  listCircuits,
  type CircuitSummary,
} from "@/lib/repos/circuits.repo";

export const metadata: Metadata = { title: "Круговые тренировки" };

export default async function CircuitsHistoryPage() {
  const user = await requireUser();
  const [recent, activeId] = await Promise.all([
    listCircuits(user.id, 60),
    getActiveCircuitId(user.id),
  ]);

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <header className="mb-6 flex items-end justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
            Круги · функциональная нагрузка
          </p>
          <h1 className="font-serif mt-1 text-4xl font-normal tracking-tight md:text-5xl">
            Круговые
          </h1>
        </div>
        <Button asChild size="lg">
          <Link href="/circuits/new">
            <Plus className="size-4" />
            Новая
          </Link>
        </Button>
      </header>

      {activeId ? <ActiveCard circuitId={activeId} /> : null}

      {recent.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-2">
          {recent.map((c) => (
            <li key={c.id}>
              <CircuitRow item={c} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function ActiveCard({ circuitId }: { circuitId: string }) {
  return (
    <Link
      href={`/circuits/${circuitId}`}
      className="bg-primary text-primary-foreground mb-6 flex items-center justify-between rounded-2xl px-5 py-4 transition-transform hover:-translate-y-px"
    >
      <div className="flex items-center gap-3">
        <div className="bg-primary-foreground/15 flex size-10 items-center justify-center rounded-full">
          <Play className="size-5 fill-current" />
        </div>
        <div>
          <p className="text-[10px] font-medium tracking-[0.18em] uppercase opacity-70">
            Активная круговая
          </p>
          <p className="text-base font-semibold tracking-tight">Продолжить</p>
        </div>
      </div>
      <ChevronRight className="size-5 opacity-70" aria-hidden="true" />
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="bg-card border-border space-y-4 rounded-2xl border p-8 text-center">
      <div className="bg-muted/60 text-muted-foreground mx-auto flex size-12 items-center justify-center rounded-full">
        <Layers className="size-5" />
      </div>
      <div>
        <p className="text-foreground text-base font-medium">
          Кругов ещё не было
        </p>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          Набор упражнений × N кругов с короткими отдыхами. Хороший вариант для
          функционалки и кардио-силовой смеси.
        </p>
      </div>
      <Button asChild size="xl" className="w-full">
        <Link href="/circuits/new">
          <Plus className="size-5" />
          Создать круговую
        </Link>
      </Button>
    </div>
  );
}

function CircuitRow({ item }: { item: CircuitSummary }) {
  const durationMin =
    item.finishedAt
      ? Math.max(
          1,
          Math.round(
            (item.finishedAt.getTime() - item.startedAt.getTime()) / 60_000,
          ),
        )
      : null;

  const expectedSlots = item.totalRounds * item.exerciseCount;

  return (
    <Link
      href={`/circuits/${item.id}`}
      className="bg-card hover:bg-accent/40 border-border block rounded-2xl border p-4 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
            {item.startedAt.toLocaleDateString("ru-RU", {
              day: "numeric",
              month: "short",
              weekday: "short",
            })}
            {item.status !== "completed" ? ` · ${item.status}` : ""}
          </p>
          <h3 className="mt-0.5 truncate text-base font-semibold tracking-tight">
            {item.name}
          </h3>
          <dl className="text-muted-foreground tabular mt-3 grid grid-cols-3 gap-3 text-xs">
            <KPI
              icon={<Repeat className="size-3" />}
              label="круги"
              value={`${item.totalRounds}`}
            />
            <KPI
              icon={<Layers className="size-3" />}
              label="выполнено"
              value={
                expectedSlots > 0
                  ? `${item.completedLogCount}/${expectedSlots}`
                  : "—"
              }
            />
            <KPI
              icon={<Timer className="size-3" />}
              label="мин"
              value={durationMin != null ? String(durationMin) : "—"}
            />
          </dl>
        </div>
        <ChevronRight
          className="text-muted-foreground size-4"
          aria-hidden="true"
        />
      </div>
    </Link>
  );
}

function KPI({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-foreground tabular flex items-center gap-1 text-sm font-semibold">
        {icon}
        {value}
      </p>
      <p className="mt-0.5">{label}</p>
    </div>
  );
}
