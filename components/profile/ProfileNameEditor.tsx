"use client";

import { Loader2, Pencil } from "lucide-react";
import { useActionState, useId } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateDisplayNameAction, type BodyState } from "@/server/actions/body";

const initial: BodyState = { status: "idle" };

export function ProfileNameForm({ initialName }: { initialName: string | null }) {
  const [state, action, pending] = useActionState(updateDisplayNameAction, initial);
  const id = useId();
  return (
    <form action={action} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor={id}>Имя в профиле</Label>
        <Input id={id} name="name" autoComplete="name" defaultValue={initialName ?? ""} maxLength={80} placeholder="Как тебя называть?" aria-describedby={`${id}-hint`} className="h-11" />
        <p id={`${id}-hint`} className="text-muted-foreground text-xs">Это имя увидят друзья. Если оставить поле пустым, будет показан email.</p>
      </div>
      {state.status === "error" ? <p role="alert" className="text-destructive text-sm">{state.message}</p> : null}
      {state.status === "success" ? <p role="status" className="text-success text-sm">Имя сохранено</p> : null}
      <Button type="submit" disabled={pending} aria-busy={pending} className="w-full sm:w-auto">
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        {pending ? "Сохраняем…" : "Сохранить имя"}
      </Button>
    </form>
  );
}

export function ProfileNameEditor({ initialName }: { initialName: string | null }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="text-muted-foreground mt-1 -ml-2">
          <Pencil className="size-3.5" aria-hidden="true" />
          Изменить имя
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Изменить имя</DialogTitle>
          <DialogDescription>Выбери имя для своего профиля.</DialogDescription>
        </DialogHeader>
        <ProfileNameForm initialName={initialName} />
      </DialogContent>
    </Dialog>
  );
}
