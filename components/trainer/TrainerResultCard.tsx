import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils/index";

export type TrainerResultData = {
  overallScore: number;
  trainingQuality: { score: number; comment: string };
  recoveryContext: { score: number | null; comment: string };
  nutritionContext: { score: number | null; comment: string };
  recommendations: string[];
  nextSessionFocus: string;
  missingDataAdvice: string | null;
  motivation: string;
};

function scoreColor(score: number | null): string {
  if (score == null) return "text-muted-foreground";
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-foreground";
  if (score >= 40) return "text-warning";
  return "text-destructive";
}

export function TrainerResultCard({
  data,
  className,
}: {
  data: TrainerResultData;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-card text-card-foreground border-border space-y-6 rounded-2xl border p-6",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
            Оценка тренера
          </p>
          <div
            className={cn(
              "tabular mt-1 font-serif text-5xl font-normal tracking-tight",
              scoreColor(data.overallScore),
            )}
          >
            {data.overallScore}
            <span className="text-muted-foreground ml-1 text-2xl">/100</span>
          </div>
        </div>
        <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-full">
          <Sparkles className="size-5" />
        </div>
      </header>

      <blockquote className="border-l-primary/40 text-foreground border-l-2 pl-4 text-sm leading-relaxed italic">
        {data.motivation}
      </blockquote>

      <dl className="space-y-4">
        <Aspect
          title="Качество тренировки"
          score={data.trainingQuality.score}
          comment={data.trainingQuality.comment}
        />
        <Aspect
          title="Восстановление (сон)"
          score={data.recoveryContext.score}
          comment={data.recoveryContext.comment}
        />
        <Aspect
          title="Питание (КБЖУ)"
          score={data.nutritionContext.score}
          comment={data.nutritionContext.comment}
        />
      </dl>

      <section>
        <h3 className="text-sm font-semibold tracking-tight">
          Что сделать в следующей сессии
        </h3>
        <p className="text-muted-foreground mt-1 text-xs">
          Фокус: <span className="text-foreground">{data.nextSessionFocus}</span>
        </p>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed">
          {data.recommendations.map((rec, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-primary/60 mt-1 size-1 shrink-0 rounded-full bg-current" />
              <span>{rec}</span>
            </li>
          ))}
        </ul>
      </section>

      {data.missingDataAdvice ? (
        <section className="bg-warning/5 border-warning/30 rounded-xl border p-4">
          <h3 className="text-warning text-xs font-semibold tracking-tight uppercase">
            Чтобы разбор был точнее
          </h3>
          <p className="mt-1 text-sm leading-relaxed">
            {data.missingDataAdvice}
          </p>
        </section>
      ) : null}
    </div>
  );
}

function Aspect({
  title,
  score,
  comment,
}: {
  title: string;
  score: number | null;
  comment: string;
}) {
  return (
    <div>
      <dt className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold tracking-tight">{title}</span>
        <span className={cn("tabular text-sm font-medium", scoreColor(score))}>
          {score ?? "—"}
        </span>
      </dt>
      <dd className="text-muted-foreground mt-1 text-sm leading-relaxed">
        {comment}
      </dd>
    </div>
  );
}
