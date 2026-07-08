"use client";

import { RefreshCw, Sparkles, ThumbsDown, ThumbsUp, Wrench } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { ProgramReviewResult } from "@/lib/domain/programs/program-review";
import { reviewProgramAction } from "@/server/actions/training-programs";

/** Оценка программы тренером на /programs/[id]. Показывает кэш (если был) и
 *  генерирует/перегенерирует по кнопке. Score — цвет по порогам (R-41: число +
 *  подпись, не только цвет). */
export function ProgramReviewCard({
  programId,
  initialReview,
  reviewedAtLabel,
}: {
  programId: string;
  initialReview: ProgramReviewResult | null;
  reviewedAtLabel: string | null;
}) {
  const [review, setReview] = useState<ProgramReviewResult | null>(initialReview);
  const [pending, startTransition] = useTransition();

  const run = () => {
    startTransition(async () => {
      const res = await reviewProgramAction(programId);
      if (res.status === "success") {
        setReview(res.review);
        toast.success("Тренер оценил программу");
      } else {
        toast.error(res.message);
      }
    });
  };

  return (
    <section className="bg-card border-border mb-5 rounded-2xl border p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold tracking-tight">
          <Sparkles className="text-primary size-4" aria-hidden="true" />
          Оценка тренера
        </h2>
        {review ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={run}
            disabled={pending}
          >
            <RefreshCw className={pending ? "size-4 animate-spin" : "size-4"} />
            Обновить
          </Button>
        ) : null}
      </div>

      {!review ? (
        <div className="space-y-3">
          <p className="text-muted-foreground text-sm leading-relaxed">
            Тренер посмотрит программу целиком — баланс групп мышц за неделю,
            логику сплита и частоту — и даст оценку с конкретными улучшениями.
          </p>
          <Button
            type="button"
            size="lg"
            className="w-full"
            onClick={run}
            disabled={pending}
          >
            <Sparkles className="size-4" />
            {pending ? "Тренер оценивает…" : "Оценить программу"}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <ScoreBadge score={review.score} />
            <p className="text-sm leading-relaxed">{review.summary}</p>
          </div>

          {review.muscleBalance ? (
            <p className="text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 text-xs leading-relaxed">
              {review.muscleBalance}
            </p>
          ) : null}

          {review.strengths.length ? (
            <ReviewList
              icon={<ThumbsUp className="size-3.5 text-emerald-500" />}
              title="Сильные стороны"
              items={review.strengths}
            />
          ) : null}
          {review.weaknesses.length ? (
            <ReviewList
              icon={<ThumbsDown className="text-amber-500 size-3.5" />}
              title="Слабые места"
              items={review.weaknesses}
            />
          ) : null}
          {review.recommendations.length ? (
            <ReviewList
              icon={<Wrench className="text-primary size-3.5" />}
              title="Что улучшить"
              items={review.recommendations}
            />
          ) : null}

          {reviewedAtLabel ? (
            <p className="text-muted-foreground/70 text-[10px] tracking-wide uppercase">
              Оценка от {reviewedAtLabel}
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 75
      ? "text-emerald-500"
      : score >= 50
        ? "text-amber-500"
        : "text-destructive";
  return (
    <div className="shrink-0 text-center">
      <p className={`font-serif tabular text-3xl font-normal ${tone}`}>{score}</p>
      <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
        из 100
      </p>
    </div>
  );
}

function ReviewList({
  icon,
  title,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
}) {
  return (
    <div>
      <p className="text-muted-foreground mb-1.5 inline-flex items-center gap-1.5 text-[10px] font-medium tracking-wide uppercase">
        {icon}
        {title}
      </p>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2 text-sm leading-relaxed">
            <span className="text-muted-foreground">•</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
