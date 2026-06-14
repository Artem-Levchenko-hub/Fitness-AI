import { ChevronRight, Sparkles } from "lucide-react";
import Link from "next/link";

import { BalanceSilhouette } from "@/components/trainer/BalanceSilhouette";
import { resolveExerciseHref } from "@/lib/ai/exercise-links";
import { resolveLifeFactorHref } from "@/lib/ai/life-factor-links";
import type { MuscleKey } from "@/lib/domain/avatar/heat";
import type { TrendStatus } from "@/lib/domain/progression/trend";
import { TREND_TONE } from "@/lib/ui/trend-tone";
import { cn } from "@/lib/utils/index";

export type ExerciseComparison = {
  name: string;
  prevTopSet: string | null;
  curTopSet: string;
  deltaReps: number | null;
  deltaWeightKg: number | null;
  status: TrendStatus;
};

export type TrainerResultData = {
  overallScore: number;
  trainingQuality: { score: number; comment: string };
  recoveryContext: { score: number | null; comment: string };
  nutritionContext: { score: number | null; comment: string };
  exerciseComparisons?: ExerciseComparison[];
  recommendations: string[];
  nextSessionFocus: string;
  missingDataAdvice: string | null;
  motivation: string;
  whatWorked?: string;
  followUpQuestion?: string;
  pastAdviceFollowUp?: string;
  muscleBalanceNote?: string;
  /** H17.0-B — ключи групп, названных в muscleBalanceNote: под кликабельный
   *  силуэт (текст→тело). Пусто/нет → силуэт не рендерится (R-37). */
  balanceMuscleKeys?: MuscleKey[];
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
  exerciseLinks,
  linkLifeFactors,
  pastAdviceHref,
}: {
  data: TrainerResultData;
  className?: string;
  /**
   * H13.1 — карта «имя упражнения → exerciseId» из РАЗБИРАЕМОЙ тренировки.
   * Когда задана, строки прогресса становятся ссылками на историю упражнения
   * (своя тренировка). Default off (undefined) → строки статичны: share-view
   * `/a/[token]` и разбор друга НЕ передают карту (ссылка увела бы в чужую
   * историю — прецедент H6.2b `linkExercises`).
   */
  exerciseLinks?: Record<string, string>;
  /**
   * H13.2/H13.3 — на СВОЁМ разборе заголовки факторов жизни становятся входом
   * в данные: «Восстановление (сон)» → /sleep, «Питание (КБЖУ)» → /nutrition,
   * когда фактор учтён (score != null). Default off → статика: share/друг НЕ
   * передают (ссылка увела бы смотрящего в ЕГО экран, не в данные автора).
   */
  linkLifeFactors?: boolean;
  /**
   * H13.5 — на СВОЁМ разборе заголовок секции «Прошлый совет» ведёт в сам тот
   * прошлый разбор (свежайший предшественник того же ряда, что кормит «Память
   * тренера»). Резолвится на сервере (own-view page); share/друг НЕ передают →
   * статичный заголовок. `null`/undefined → статика (R-37 — некуда вести).
   */
  pastAdviceHref?: string | null;
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
          href={resolveLifeFactorHref(
            "/sleep",
            data.recoveryContext.score,
            linkLifeFactors,
          )}
        />
        <Aspect
          title="Питание (КБЖУ)"
          score={data.nutritionContext.score}
          comment={data.nutritionContext.comment}
          href={resolveLifeFactorHref(
            "/nutrition",
            data.nutritionContext.score,
            linkLifeFactors,
          )}
        />
      </dl>

      {data.whatWorked?.trim() ? (
        <section className="bg-success/5 border-success/30 rounded-xl border p-4">
          <h3 className="text-success text-xs font-semibold tracking-tight uppercase">
            Что хорошо
          </h3>
          <p className="text-foreground mt-1 text-sm leading-relaxed">
            {data.whatWorked}
          </p>
        </section>
      ) : null}

      {data.pastAdviceFollowUp?.trim() ? (
        <section className="bg-primary/5 border-primary/30 rounded-xl border p-4">
          <h3 className="text-primary text-xs font-semibold tracking-tight uppercase">
            {pastAdviceHref ? (
              <AnalysisLink href={pastAdviceHref} className="text-primary">
                Прошлый совет
              </AnalysisLink>
            ) : (
              "Прошлый совет"
            )}
          </h3>
          <p className="text-foreground mt-1 text-sm leading-relaxed">
            {data.pastAdviceFollowUp}
          </p>
        </section>
      ) : null}

      {data.muscleBalanceNote?.trim() ? (
        <section className="bg-primary/5 border-primary/30 rounded-xl border p-4">
          <h3 className="text-primary text-xs font-semibold tracking-tight uppercase">
            Баланс по аватару
          </h3>
          <p className="text-foreground mt-1 text-sm leading-relaxed">
            {data.muscleBalanceNote}
          </p>
          {data.balanceMuscleKeys && data.balanceMuscleKeys.length > 0 ? (
            <BalanceSilhouette muscleKeys={data.balanceMuscleKeys} />
          ) : null}
        </section>
      ) : null}

      {data.exerciseComparisons && data.exerciseComparisons.length > 0 ? (
        <section>
          <h3 className="text-sm font-semibold tracking-tight">
            Прогресс по упражнениям
          </h3>
          <ul className="mt-3 space-y-1.5">
            {data.exerciseComparisons.map((c, i) => (
              <ComparisonRow
                key={i}
                c={c}
                href={resolveExerciseHref(c.name, exerciseLinks)}
              />
            ))}
          </ul>
        </section>
      ) : null}

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

      {data.followUpQuestion?.trim() ? (
        <blockquote className="border-l-primary/40 text-foreground border-l-2 pl-4 text-sm leading-relaxed">
          <span className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
            Вопрос от тренера
          </span>
          <p className="mt-1 italic">{data.followUpQuestion}</p>
        </blockquote>
      ) : null}
    </div>
  );
}

/** H13.4 — единый аффорданс кликабельного разбора (Rule-of-Three: строки
 *  прогресса ComparisonRow + заголовки факторов Aspect делили одну обвязку).
 *  Пунктир-подчёркивание + шеврон, тап ≥44px (R-41), focus-ring. Вызывающий
 *  добавляет контекстный className (вес шрифта, flex-усечение). */
function AnalysisLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "text-foreground hover:text-primary focus-visible:ring-ring -my-1 inline-flex min-h-11 items-center gap-1 rounded-sm underline decoration-dotted underline-offset-4 outline-none focus-visible:ring-2",
        className,
      )}
    >
      {children}
      <ChevronRight className="size-3.5 shrink-0 opacity-60" />
    </Link>
  );
}

/** Строка сравнения упражнения: рост зелёным, регресс мягко-красным,
 *  стагнация серым. «60×5 → 60×6» с подсветкой текущего сета.
 *  H13.1: при наличии href имя — ссылка на историю упражнения (через
 *  AnalysisLink — пунктир + шеврон, тап ≥44px R-41); без href — статичный текст. */
function ComparisonRow({
  c,
  href,
}: {
  c: ExerciseComparison;
  href: string | null;
}) {
  const tone = TREND_TONE[c.status];
  return (
    <li
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg px-3 py-2",
        tone.bg,
      )}
    >
      {href ? (
        <AnalysisLink href={href} className="min-w-0 flex-1 text-sm font-medium">
          <span className="min-w-0 truncate">{c.name}</span>
        </AnalysisLink>
      ) : (
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {c.name}
        </span>
      )}
      <span className="tabular flex shrink-0 items-center gap-1.5 text-sm">
        {c.prevTopSet ? (
          <span className="text-muted-foreground">{c.prevTopSet} →</span>
        ) : null}
        <span className={cn("font-semibold", tone.text)}>
          {c.curTopSet} {tone.icon}
        </span>
      </span>
    </li>
  );
}

/** H13.2/H13.3: при наличии href заголовок аспекта — ссылка на экран фактора
 *  (пунктир-подчёркивание + шеврон, тап ≥44px R-41, зеркало ComparisonRow);
 *  без href — статичный текст. */
function Aspect({
  title,
  score,
  comment,
  href,
}: {
  title: string;
  score: number | null;
  comment: string;
  href?: string | null;
}) {
  return (
    <div>
      <dt className="flex items-center justify-between gap-2">
        {href ? (
          <AnalysisLink href={href} className="text-sm font-semibold tracking-tight">
            {title}
          </AnalysisLink>
        ) : (
          <span className="text-sm font-semibold tracking-tight">{title}</span>
        )}
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
