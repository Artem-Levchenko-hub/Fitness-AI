"use client";

import { Undo2 } from "lucide-react";
import { useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { revertTemplateAdaptationAction } from "@/server/actions/templates";

/** «Отменить корректировку ИИ тренера» — вернуть шаблон к виду ДО правок тренера
 *  (восстановить из снимка) и попросить тренера больше не переписывать его сам
 *  (липкий отказ). Откат стирает снимок — необратим, поэтому подтверждаем
 *  диалогом тем же паттерном, что ConfirmDeleteButton. Deep-module (R-01):
 *  прячет диалог и pending; страница про механику не знает. */
export function RevertAdaptationButton({ templateId }: { templateId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-foreground -ml-2"
      >
        <Undo2 className="size-4" />
        Отменить корректировку
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Отменить корректировку ИИ тренера?</DialogTitle>
            <DialogDescription>
              Шаблон вернётся к виду до правок тренера. Тренер больше не будет
              менять его сам, пока ты не включишь это заново.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Оставить
            </Button>
            <form
              action={async (formData) => {
                await revertTemplateAdaptationAction(formData);
                setOpen(false);
              }}
            >
              <input type="hidden" name="templateId" value={templateId} />
              <RevertSubmit />
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RevertSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      <Undo2 className="size-4" />
      {pending ? "Отменяем…" : "Отменить корректировку"}
    </Button>
  );
}
