import { ChevronRight, Layers, Play } from "lucide-react";
import Link from "next/link";

import {
  getActiveCircuitId,
  listCircuits,
} from "@/lib/repos/circuits.repo";

/** Тайл круговых для главной — мирорит CardioTile.
 *  Если есть активная — Resume; иначе показывает последнюю или CTA. */
export async function CircuitTile({ userId }: { userId: string }) {
  const [activeId, recent] = await Promise.all([
    getActiveCircuitId(userId),
    listCircuits(userId, 1),
  ]);
  const last = recent.find((c) => c.status === "completed") ?? null;

  if (activeId) {
    return (
      <Link
        href={`/circuits/${activeId}`}
        className="bg-primary text-primary-foreground flex items-center justify-between rounded-2xl px-5 py-4 transition-transform hover:-translate-y-px"
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

  return (
    <Link
      href={last ? "/circuits" : "/circuits/new"}
      className="bg-card hover:bg-accent/40 border-border flex items-center justify-between rounded-2xl border px-5 py-4 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-full">
          <Layers className="size-5" />
        </div>
        <div>
          <p className="text-[10px] font-medium tracking-[0.18em] uppercase opacity-70">
            Круговая · функциональная
          </p>
          <p className="text-base font-semibold tracking-tight">
            {last
              ? `Последняя: ${last.name} · ${last.startedAt.toLocaleDateString(
                  "ru-RU",
                  { day: "numeric", month: "short" },
                )}`
              : "Создать круговую"}
          </p>
        </div>
      </div>
      <ChevronRight
        className="text-muted-foreground size-5"
        aria-hidden="true"
      />
    </Link>
  );
}
