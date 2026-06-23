"use client";

import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
} from "framer-motion";
import { Trash2 } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
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

/** Обобщённый свайп-влево-удаление (R-01 deep module): прячет жест, красную зону
 *  и диалог подтверждения за узким интерфейсом, оставляя `children` чистым
 *  presentational (строка-ссылка/карточка про удаление не знает). Поднят из
 *  `swipeable-history-card`, чтобы тот же паттерн работал на шаблонах (правило
 *  трёх — история + /create + /templates). Удаление необратимо → подтверждаем
 *  диалогом. A11y/десктоп (R-39): красная кнопка реальная и фокусируемая — на
 *  focus слой отъезжает, открывая её клавиатурой; мышью drag тоже работает.
 *  prefers-reduced-motion → без пружин, мгновенный снап. */

const REVEAL = 96; // на сколько уезжает слой, открывая красную зону (= её ширина)
const COMMIT = 56; // порог свайпа, после которого спрашиваем подтверждение (≥56px, R-41)

export function SwipeToDelete({
  children,
  action,
  hidden,
  title,
  description,
  deleteAriaLabel,
  confirmLabel = "Удалить",
}: {
  /** Содержимое строки — обычно <Link>/кнопка старта; остаётся интерактивным. */
  children: ReactNode;
  /** Server Action удаления; получает FormData со скрытыми полями `hidden`. */
  action: (formData: FormData) => void | Promise<void>;
  hidden: Record<string, string>;
  title: string;
  description: string;
  /** aria-label красной кнопки, например «Удалить шаблон «Грудь»». */
  deleteAriaLabel: string;
  confirmLabel?: string;
}) {
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

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Красная зона под слоем — проступает по мере свайпа влево. */}
      <div className="absolute inset-y-0 right-0 flex">
        <button
          type="button"
          aria-label={deleteAriaLabel}
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

      {/* Слой поверх. Тап проходит в children, свайп влево открывает зону. */}
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
          // Только что свайпнули → не пускаем тап внутрь (старт/переход).
          if (draggedRef.current) {
            e.preventDefault();
            e.stopPropagation();
            draggedRef.current = false;
          }
        }}
        className="relative touch-pan-y"
      >
        {children}
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
              <DeleteSubmit label={confirmLabel} />
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DeleteSubmit({ label }: { label: string }) {
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
