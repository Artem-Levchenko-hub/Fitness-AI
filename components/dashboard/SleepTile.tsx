import { Moon, Plus } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { localDateIso } from "@/lib/datetime/local-day";
import { getSleepForDate } from "@/lib/repos/sleep.repo";

export async function SleepTile({ userId, timeZone }: { userId: string; timeZone: string }) {
  const row = await getSleepForDate(userId, localDateIso(new Date(), timeZone));

  return (
    <div oai-annotatable="Сон сегодня" className="bg-card border-border flex items-center justify-between gap-4 rounded-2xl border p-4">
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-full">
          <Moon className="size-5" />
        </div>
        <div>
          <p className="text-muted-foreground text-[11px] font-medium tracking-[0.18em] uppercase">
            Сон сегодня
          </p>
          {row ? (
            <p className="tabular text-foreground mt-0.5 text-lg font-semibold">
              {row.hours.toFixed(1)} ч
              {row.quality ? (
                <span className="text-muted-foreground ml-2 text-xs font-normal">
                  · {row.quality}/5
                </span>
              ) : null}
            </p>
          ) : (
            <p className="text-muted-foreground mt-0.5 text-sm">не указан</p>
          )}
        </div>
      </div>
      <Button asChild variant={row ? "ghost" : "outline"} size="sm">
        <Link href="/sleep">
          {row ? "Изменить" : (
            <>
              <Plus className="size-4" /> Записать
            </>
          )}
        </Link>
      </Button>
    </div>
  );
}
