"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type PickerExercise = {
  id: string;
  nameRu: string;
  nameEn: string;
  isCustom: boolean;
};

export function ExercisePicker({
  exercises,
  value,
  onChange,
  placeholder = "Выберите упражнение",
  disabled,
}: {
  exercises: ReadonlyArray<PickerExercise>;
  value: string | null;
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const selected = useMemo(
    () => exercises.find((e) => e.id === value) ?? null,
    [exercises, value],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !selected && "text-muted-foreground",
          )}
        >
          <span className="truncate">
            {selected ? selected.nameRu : placeholder}
          </span>
          <ChevronsUpDown className="size-4 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(420px,calc(100vw-2rem))] p-0" align="start">
        <Command
          filter={(itemValue, search) => {
            const exercise = exercises.find((e) => e.id === itemValue);
            if (!exercise) return 0;
            const q = search.toLowerCase();
            return exercise.nameRu.toLowerCase().includes(q) ||
              exercise.nameEn.toLowerCase().includes(q)
              ? 1
              : 0;
          }}
        >
          <CommandInput placeholder="Поиск упражнения…" />
          <CommandList>
            <CommandEmpty>Не найдено.</CommandEmpty>
            <CommandGroup>
              {exercises.map((ex) => (
                <CommandItem
                  key={ex.id}
                  value={ex.id}
                  onSelect={() => {
                    onChange(ex.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "size-4",
                      ex.id === value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="flex flex-1 flex-col">
                    <span className="text-sm">{ex.nameRu}</span>
                    <span className="text-muted-foreground text-xs">
                      {ex.nameEn}
                      {ex.isCustom ? " · моё" : ""}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
