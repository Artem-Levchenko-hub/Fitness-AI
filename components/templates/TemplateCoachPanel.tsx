"use client";

import { Check, Sparkles, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  applyRefinedTemplateAction,
  refineTemplateAction,
  type RefineProposalItem,
} from "@/server/actions/templates";

type Proposal = {
  score: number;
  assessment: string;
  changes: string[];
  items: RefineProposalItem[];
};

/** «Улучшить с тренером» на /templates/[id]: атлет пишет комментарий (что
 *  поменял и почему / чего хочет), тренер даёт оценку и предлагает улучшенную
 *  версию шаблона. «Применить» перезаписывает шаблон предложенными упражнениями.
 *  Только для силовых шаблонов (у них есть целевые подходы/повторы). */
export function TemplateCoachPanel({ templateId }: { templateId: string }) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [refining, startRefine] = useTransition();
  const [applying, startApply] = useTransition();

  const askCoach = () => {
    startRefine(async () => {
      const res = await refineTemplateAction({ templateId, comment: comment.trim() });
      if (res.status === "success") {
        setProposal({
          score: res.score,
          assessment: res.assessment,
          changes: res.changes,
          items: res.items,
        });
      } else {
        toast.error(res.message);
      }
    });
  };

  const apply = () => {
    if (!proposal) return;
    startApply(async () => {
      const res = await applyRefinedTemplateAction({
        templateId,
        items: proposal.items.map((it) => ({
          exerciseId: it.exerciseId,
          sets: it.sets,
          repsMin: it.repsMin,
          repsMax: it.repsMax,
          restSeconds: it.restSeconds,
          setScheme: it.setScheme,
          myoMiniSets: it.myoMiniSets,
          myoRepsPercent: it.myoRepsPercent,
          myoRestSeconds: it.myoRestSeconds,
          note: it.note,
        })),
      });
      if (res.status === "success") {
        toast.success("Шаблон обновлён по совету тренера");
        setProposal(null);
        setComment("");
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  };

  return (
    <section className="border-border bg-card mt-6 rounded-2xl border p-5">
      <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold tracking-tight">
        <Sparkles className="text-primary size-4" aria-hidden="true" />
        Улучшить с тренером
      </h2>
      <p className="text-muted-foreground mt-1 mb-3 text-xs leading-relaxed">
        Напиши, что поменял и почему или чего хочешь от тренировки — тренер оценит
        шаблон и предложит, как выжать из него максимум.
      </p>

      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Например: убрал становую — болит поясница. Хочу упор на грудь и меньше времени."
        rows={3}
        maxLength={600}
        disabled={refining}
      />

      <Button
        type="button"
        size="lg"
        className="mt-3 w-full"
        onClick={askCoach}
        disabled={refining}
      >
        <Sparkles className="size-4" />
        {refining ? "Тренер думает…" : "Оценить и улучшить"}
      </Button>

      {proposal ? (
        <div className="border-border mt-5 space-y-4 border-t pt-5">
          <div className="flex items-center gap-3">
            <div className="shrink-0 text-center">
              <p className="font-serif tabular text-3xl font-normal">
                {proposal.score}
              </p>
              <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
                из 100
              </p>
            </div>
            <p className="text-sm leading-relaxed">{proposal.assessment}</p>
          </div>

          {proposal.changes.length ? (
            <div>
              <p className="text-muted-foreground mb-1.5 inline-flex items-center gap-1.5 text-[10px] font-medium tracking-wide uppercase">
                <Wrench className="text-primary size-3.5" />
                Что тренер предлагает
              </p>
              <ul className="space-y-1.5">
                {proposal.changes.map((c, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-relaxed">
                    <span className="text-muted-foreground">•</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <p className="text-muted-foreground mb-2 text-[10px] font-medium tracking-wide uppercase">
              Улучшенный шаблон ({proposal.items.length} упр.)
            </p>
            <ol className="space-y-2">
              {proposal.items.map((it, i) => (
                <li
                  key={`${it.exerciseId}-${i}`}
                  className="bg-muted/40 flex items-start gap-3 rounded-xl p-3"
                >
                  <span className="text-muted-foreground bg-background mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium tabular-nums">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{it.nameRu}</p>
                    <div className="text-muted-foreground tabular mt-0.5 flex flex-wrap gap-x-3 text-xs">
                      {it.setScheme === "myo_reps" ? (
                        <>
                          <span>Myo-reps</span>
                          <span>
                            активация {it.repsMin}–{it.repsMax}
                          </span>
                          <span>
                            {it.myoMiniSets} мини по {it.myoRepsPercent}%
                          </span>
                          <span>отдых {it.myoRestSeconds}с</span>
                        </>
                      ) : (
                        <>
                          <span>
                            {it.sets}×{it.repsMin}–{it.repsMax}
                          </span>
                          <span>отдых {it.restSeconds}с</span>
                        </>
                      )}
                    </div>
                    {it.note ? (
                      <p className="text-muted-foreground/80 mt-1 text-xs leading-relaxed">
                        {it.note}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              className="flex-1"
              onClick={apply}
              disabled={applying}
            >
              <Check className="size-4" />
              {applying ? "Применяем…" : "Применить улучшение"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setProposal(null)}
              disabled={applying}
            >
              Оставить как есть
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
