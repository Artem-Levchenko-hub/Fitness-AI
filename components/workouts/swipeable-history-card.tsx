"use client";

import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
} from "framer-motion";
import { Trash2 } from "lucide-react";
import { useRef, useState } from "react";
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
import {
  HistoryCard,
  type HistoryItem,
} from "@/components/workouts/workout-history";
import { deleteHistoryItemAction } from "@/server/actions/history";

/** H-DEL — свайп-влево удаление из ленты «История». Обёртка-deep-module (R-01):
 *  прячет жест и диалог, `HistoryCard` остаётся чистым presentational и про
 *  удаление не знает. Удаление необратимо (каскад сносит подходы + AI-разбор),
 *  поэтому подтверждаем диалогом — тем же паттерном, что `ConfirmDeleteButton`.
 *  A11y/десктоп (R-39): красная кнопка реальная и фокусируемая — на focus
 *  карточка отъезжает, открывая её клавиатурой; мышью drag тоже работает.
 *  prefers-reduced-motion → без пружин, мгновенный снап. */

const REVEAL = 96; // на сколько уезжает карточка, открывая красную зону (= её ширина)
const COMMIT = 56; // порог свайпа, после которого спрашиваем подтверждение (≥56px, R-41)

const KIND_ACCUSATIVE: Record<HistoryItem["kind"], string> = {
  strength: "тренировку",
  circuit: "круговую",
  cardio: "кардио",
};

export function SwipeableHistoryCard({ item }: { item: HistoryItem }) {
  const x = useMotionValue(0);
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const draggedRef = useRef(false);

  const snapTo = (to: number) => {
    if (reduced) {
      x.set(to);
      return;
    }
    void animate(x, to, { type: "spring", stiffness: 520, damping: 42 });
  };

  const label = KIND_ACCUSATIVE[item.kind];

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Красная зона под карточкой — проступает по мере свайпа влево. */}
      <div className="absolute inset-y-0 right-0 flex">
        <button
          type="button"
          aria-label={`Удалить ${label}`}
          onClick={() => setOpen(true)}
          onFocus={() => snapTo(-REVEAL)}
          onBlur={() => {
            if (!open) snapTo(0);
          }}
          className="bg-destructive text-destructive-foreground focus-visible:ring-ring flex min-h-14 w-24 flex-col items-center justify-center gap-1 text-[11px] font-medium tracking-wide focus-visible:ring-2 focus-visible:outline-none"
        >
          <Trash2 className="size-5" aria-hidden="true" />
          Удалить
        </button>
      </div>

      {/* Карточка поверх. Тап ведёт в детали, свайп влево открывает зону. */}
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -REVEAL, right: 0 }}
        dragElastic={{ left: 0.06, right: 0 }}
        style={{ x }}
        onDragStart={() => {
          draggedRef.current = false;
        }}
        onDrag={(_, info) => {
          if (Math.abs(info.offset.x) > 6) draggedRef.current = true;
        }}
        onDragEnd={(_, info) => {
          const past = info.offset.x < -COMMIT || info.velocity.x < -500;
          if (past) {
            snapTo(-REVEAL);
            setOpen(true);
          } else {
            snapTo(0);
          }
        }}
        onClickCapture={(e) => {
          // Только что свайпнули → не пускаем тап в детали.
          if (draggedRef.current) {
            e.preventDefault();
            e.stopPropagation();
            draggedRef.current = false;
          }
        }}
        className="bg-background relative touch-pan-y"
      >
        <HistoryCard item={item} />
      </motion.div>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) snapTo(0);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Удалить {label}?</DialogTitle>
            <DialogDescription>
              «{item.name}» удалится безвозвратно — вместе с подходами и
              AI-разбором. Сессия перестанет учитываться в статистике.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <form action={deleteHistoryItemAction}>
              <input type="hidden" name="kind" value={item.kind} />
              <input type="hidden" name="id" value={item.id} />
              <DeleteSubmit />
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DeleteSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="destructive"
      disabled={pending}
      className="w-full sm:w-auto"
    >
      <Trash2 className="size-4" />
      {pending ? "Удаляем…" : "Удалить"}
    </Button>
  );
}
