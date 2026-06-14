"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { copyFromLibraryAction } from "@/server/actions/training-programs";

/** «Добавить в мои системы» — копирует пресет библиотеки к пользователю (на
 *  полку) и уводит в его новую копию, где можно «Начать тренироваться».
 *  Pending-состояние, чтобы двойной тап не плодил копии (серверная копия —
 *  отдельная транзакция). */
export function UseProgramButton({ librarySlug }: { librarySlug: string }) {
  return (
    <form action={copyFromLibraryAction} className="mb-7">
      <input type="hidden" name="librarySlug" value={librarySlug} />
      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="xl" className="w-full" disabled={pending}>
      {pending ? "Добавляем…" : "Добавить в мои системы"}
    </Button>
  );
}
