import { Apple, Plus } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { localDateIso } from "@/lib/datetime/local-day";
import { getNutritionForDate } from "@/lib/repos/nutrition.repo";

export async function NutritionTile({ userId, timeZone }: { userId: string; timeZone: string }) {
  const row = await getNutritionForDate(userId, localDateIso(new Date(), timeZone));

  return (
    <div oai-annotatable="КБЖУ сегодня" className="bg-card border-border flex items-center justify-between gap-4 rounded-2xl border p-4">
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-full">
          <Apple className="size-5" />
        </div>
        <div>
          <p className="text-muted-foreground text-[11px] font-medium tracking-[0.18em] uppercase">
            КБЖУ сегодня
          </p>
          {row ? (
            <p className="tabular text-foreground mt-0.5 text-sm font-semibold">
              {row.kcal ?? "—"} ккал
              <span className="text-muted-foreground ml-2 text-xs font-normal">
                · Б {row.proteinG ?? "—"} · Ж {row.fatG ?? "—"} · У{" "}
                {row.carbsG ?? "—"}
              </span>
            </p>
          ) : (
            <p className="text-muted-foreground mt-0.5 text-sm">не указано</p>
          )}
        </div>
      </div>
      <Button asChild variant={row ? "ghost" : "outline"} size="sm">
        <Link href="/nutrition">
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
