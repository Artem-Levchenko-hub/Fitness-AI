import { Dumbbell } from "lucide-react";

import { getExerciseDemo } from "@/lib/domain/exercises/demos";
import { cn } from "@/lib/utils/cn";

type Variant = "hero" | "thumb" | "background";

/** Self-hosted exercise demo GIF, resolved by stable slug.
 *  - `hero`: large square on the exercise detail page.
 *  - `thumb`: small square beside a name (list, picker, active card).
 *  - `background`: faint, full-bleed behind a timer (parent must be relative).
 *  No demo → a neutral placeholder (R-37) for hero/thumb; nothing for background. */
export function ExerciseDemo({
  slug,
  alt,
  variant = "thumb",
  className,
}: {
  slug: string | null | undefined;
  alt: string;
  variant?: Variant;
  className?: string;
}) {
  const demo = getExerciseDemo(slug);

  if (variant === "background") {
    if (!demo) return null;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={demo.gif}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        className={cn(
          "pointer-events-none absolute inset-0 size-full object-cover opacity-15",
          className,
        )}
      />
    );
  }

  const boxBase =
    variant === "hero"
      ? "aspect-square w-full max-w-xs rounded-2xl"
      : "size-11 shrink-0 rounded-lg";

  if (!demo) {
    return (
      <div
        aria-hidden="true"
        className={cn(
          "bg-muted text-muted-foreground flex items-center justify-center",
          boxBase,
          className,
        )}
      >
        <Dumbbell className={variant === "hero" ? "size-10" : "size-5"} />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={demo.gif}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={cn("bg-white object-contain", boxBase, className)}
    />
  );
}
