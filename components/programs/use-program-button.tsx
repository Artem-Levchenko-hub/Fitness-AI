"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { copyFromLibraryAction } from "@/server/actions/training-programs";

/** «Использовать программу из библиотеки» — копирует пресет к пользователю и
 *  уводит в его новую копию. Pending-состояние, чтобы двойной тап не плодил
 *  копии визуально (серверная копия — отдельная транзакция). */
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
      {pending ? "Копируем к себе…" : "Использовать программу"}
    </Button>
  );
}
