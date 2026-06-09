"use client";

import { Trash2 } from "lucide-react";
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
import { cn } from "@/lib/utils";

type Props = {
  /** Server Action — получает FormData со скрытыми полями `hidden`. */
  action: (formData: FormData) => void | Promise<void>;
  /** Скрытые поля формы (например `{ workoutId }`). */
  hidden: Record<string, string>;
  title: string;
  description: string;
  triggerLabel?: string;
  confirmLabel?: string;
  /** Растянуть триггер на всю ширину. */
  fullWidth?: boolean;
  className?: string;
};

/** Кнопка деструктивного удаления с обязательным подтверждением.
 *  Прячет за узким интерфейсом всю механику диалога и pending-состояния. */
export function ConfirmDeleteButton({
  action,
  hidden,
  title,
  description,
  triggerLabel = "Удалить",
  confirmLabel = "Удалить",
  fullWidth = false,
  className,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className={cn(
          "text-destructive hover:bg-destructive/10 hover:text-destructive",
          fullWidth && "w-full",
          className,
        )}
      >
        <Trash2 className="size-4" />
        {triggerLabel}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <form action={action}>
              {Object.entries(hidden).map(([name, value]) => (
                <input key={name} type="hidden" name={name} value={value} />
              ))}
              <ConfirmSubmit label={confirmLabel} />
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ConfirmSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="destructive"
      disabled={pending}
      className="w-full sm:w-auto"
    >
      <Trash2 className="size-4" />
      {pending ? "Удаляем…" : label}
    </Button>
  );
}
