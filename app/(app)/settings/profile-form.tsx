"use client";

import { Loader2 } from "lucide-react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type BodyState,
  updateProfileAction,
} from "@/server/actions/body";

const initial: BodyState = { status: "idle" };

type Props = {
  initialBirthDate: string | null;
  initialHeightCm: number | null;
  initialSex: string | null;
  initialWeightUnit: "kg" | "lb";
  initialExperience: "beginner" | "intermediate" | "advanced";
  initialTimezone: string;
};

export function ProfileForm(props: Props) {
  const [state, formAction, pending] = useActionState<BodyState, FormData>(
    updateProfileAction,
    initial,
  );

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="birthDate" className="text-xs">
            Дата рождения
          </Label>
          <Input
            id="birthDate"
            name="birthDate"
            type="date"
            defaultValue={props.initialBirthDate ?? ""}
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="heightCm" className="text-xs">
            Рост (см)
          </Label>
          <Input
            id="heightCm"
            name="heightCm"
            type="number"
            inputMode="numeric"
            min={100}
            max={250}
            defaultValue={props.initialHeightCm ?? ""}
            className="tabular h-11"
            placeholder="напр. 178"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Пол</Label>
          <Select name="sex" defaultValue={props.initialSex ?? ""}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Не указан" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Мужской</SelectItem>
              <SelectItem value="female">Женский</SelectItem>
              <SelectItem value="other">Другой</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Единицы веса</Label>
          <Select
            name="weightUnitPref"
            defaultValue={props.initialWeightUnit}
          >
            <SelectTrigger className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="kg">кг</SelectItem>
              <SelectItem value="lb">lb (фунты)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Опыт</Label>
          <Select name="experience" defaultValue={props.initialExperience}>
            <SelectTrigger className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="beginner">Начинающий</SelectItem>
              <SelectItem value="intermediate">Средний</SelectItem>
              <SelectItem value="advanced">Продвинутый</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="timezone" className="text-xs">
            Часовой пояс
          </Label>
          <Input
            id="timezone"
            name="timezone"
            defaultValue={props.initialTimezone}
            placeholder="Europe/Moscow"
            className="h-11"
          />
        </div>
      </div>

      {state.status === "error" ? (
        <p
          className="bg-destructive/10 text-destructive border-destructive/20 rounded-md border px-3 py-2 text-sm"
          role="alert"
        >
          {state.message}
        </p>
      ) : null}
      {state.status === "success" ? (
        <p className="bg-success/10 text-success border-success/20 rounded-md border px-3 py-2 text-sm">
          Профиль сохранён
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Сохраняем…
          </>
        ) : (
          "Сохранить профиль"
        )}
      </Button>
    </form>
  );
}
