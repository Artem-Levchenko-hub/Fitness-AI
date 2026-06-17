"use client";

import { Search, Sparkles, User } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { ExerciseDemo } from "@/components/app/ExerciseDemo";
import { MuscleBadges, muscleLabel } from "@/components/app/MuscleBadges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type { ExerciseListItem } from "@/lib/repos/exercises.repo";
import { cn } from "@/lib/utils";

type MuscleKey = ExerciseListItem["primaryMuscles"][number];

type Props = {
  exercises: ExerciseListItem[];
  muscleKeys: ReadonlyArray<MuscleKey>;
};

export function ExercisesExplorer({ exercises, muscleKeys }: Props) {
  const [search, setSearch] = useState("");
  const [muscle, setMuscle] = useState<MuscleKey | null>(null);
  const [tab, setTab] = useState<"all" | "system" | "custom">("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return exercises.filter((ex) => {
      if (tab === "system" && ex.isCustom) return false;
      if (tab === "custom" && !ex.isCustom) return false;
      if (
        muscle &&
        !ex.primaryMuscles.includes(muscle) &&
        !ex.secondaryMuscles.includes(muscle)
      )
        return false;
      if (
        q &&
        !ex.nameRu.toLowerCase().includes(q) &&
        !ex.nameEn.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [exercises, search, muscle, tab]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
        <Input
          type="search"
          inputMode="search"
          placeholder="Поиск по названию"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        <button
          type="button"
          onClick={() => setMuscle(null)}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
            muscle === null
              ? "bg-primary text-primary-foreground border-transparent"
              : "border-border bg-card text-muted-foreground hover:text-foreground",
          )}
        >
          Все
        </button>
        {muscleKeys.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setMuscle(muscle === k ? null : k)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
              muscle === k
                ? "bg-primary text-primary-foreground border-transparent"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {muscleLabel(k)}
          </button>
        ))}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">Все</TabsTrigger>
          <TabsTrigger value="system">
            <Sparkles className="size-3.5" />
            Системные
          </TabsTrigger>
          <TabsTrigger value="custom">
            <User className="size-3.5" />
            Мои
          </TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          <ExerciseList items={filtered} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ExerciseList({ items }: { items: ExerciseListItem[] }) {
  if (items.length === 0) {
    return (
      <div className="bg-card text-muted-foreground border-border rounded-2xl border p-6 text-center text-sm">
        Ничего не нашлось.{" "}
        <Link
          href="/exercises/new"
          className="text-primary font-medium underline-offset-4 hover:underline"
        >
          Добавить своё
        </Link>
        .
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((ex) => (
        <li key={ex.id}>
          <Link
            href={`/exercises/${ex.id}`}
            className="bg-card hover:bg-accent border-border block rounded-xl border p-4 transition-colors"
          >
            <div className="flex items-start gap-3">
              <ExerciseDemo
                slug={ex.slug}
                alt={ex.nameRu}
                variant="thumb"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-sm font-semibold">
                    {ex.nameRu}
                  </h3>
                  {ex.isCustom ? (
                    <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-medium">
                      моё
                    </span>
                  ) : null}
                </div>
                <p className="text-muted-foreground truncate text-xs">
                  {ex.nameEn}
                </p>
                <div className="mt-2">
                  <MuscleBadges
                    primary={ex.primaryMuscles}
                    secondary={ex.secondaryMuscles}
                  />
                </div>
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ExercisesEmptyToolbar() {
  return (
    <Button asChild size="lg" variant="outline">
      <Link href="/exercises/new">+ Своё упражнение</Link>
    </Button>
  );
}
