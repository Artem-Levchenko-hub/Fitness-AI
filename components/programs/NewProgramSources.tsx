"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  PlanFromHistoryBuilder,
  type HistoryWorkoutOption,
} from "./PlanFromHistoryBuilder";
import {
  ProgramWrapBuilder,
  type WrapTemplateOption,
} from "./program-wrap-builder";

/** Два источника сборки плана на /programs/new: из истории тренировок (для тех,
 *  кто тренируется по факту без шаблонов) и из готовых шаблонов. Вкладка по
 *  умолчанию — «Из истории», если своих шаблонов ещё нет (частый случай: атлет
 *  тренировался ad-hoc, шаблонов не создавал — раньше экран был тупиком). */
export function NewProgramSources({
  templates,
  workouts,
}: {
  templates: WrapTemplateOption[];
  workouts: HistoryWorkoutOption[];
}) {
  const defaultTab = templates.length === 0 ? "history" : "templates";

  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      <TabsList className="mb-5 grid w-full grid-cols-2">
        <TabsTrigger value="history">Из истории</TabsTrigger>
        <TabsTrigger value="templates">Из шаблонов</TabsTrigger>
      </TabsList>

      <TabsContent value="history">
        <PlanFromHistoryBuilder workouts={workouts} />
      </TabsContent>

      <TabsContent value="templates">
        <ProgramWrapBuilder templates={templates} />
      </TabsContent>
    </Tabs>
  );
}
