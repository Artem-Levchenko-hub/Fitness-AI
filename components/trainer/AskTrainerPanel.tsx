"use client";

import { Loader2, MessageCircleQuestion, Send } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { buildFollowUpMessages } from "@/lib/ai/follow-up";

type Props = {
  workoutId: string;
  /** Markdown готового разбора — уходит ведущим assistant-сообщением, чтобы
   *  тренер отвечал, опираясь на свой же разбор именно этой тренировки. */
  analysisMarkdown: string;
};

/** H5.8 «Спросить тренера»: один follow-up вопрос по готовому разбору →
 *  streaming-ответ через существующий /api/ai/coach. Один вопрос/один ответ,
 *  без сохранения чата в БД (finalize не вызывается). */
export function AskTrainerPanel({ workoutId, analysisMarkdown }: Props) {
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask() {
    const messages = buildFollowUpMessages(analysisMarkdown, question);
    if (!messages || streaming) return;

    const userText = question.trim();
    setAsked(userText);
    setAnswer("");
    setError(null);
    setStreaming(true);

    try {
      const res = await fetch("/api/ai/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workoutId, messages }),
      });

      if (!res.ok || !res.body) {
        const text = res.ok ? "Пустой ответ от тренера" : await res.text();
        setError(text || `Ошибка ${res.status}`);
        setAsked(null);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setAnswer(acc);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка соединения");
      setAsked(null);
    } finally {
      setStreaming(false);
    }
  }

  return (
    <section className="bg-card border-border mt-6 rounded-2xl border p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
        <MessageCircleQuestion className="text-primary size-5" />
        Спросить тренера
      </h2>
      <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
        Уточните что угодно по этому разбору — тренер ответит, опираясь на данные
        именно этой тренировки.
      </p>

      {asked ? (
        <div className="mt-4 space-y-3">
          <p className="text-foreground bg-muted ml-auto max-w-[85%] rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">
            {asked}
          </p>
          <div className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">
            {answer || (
              <span className="text-muted-foreground inline-flex items-center gap-1.5">
                <Loader2 className="size-3 animate-spin" />
                тренер думает…
              </span>
            )}
          </div>
        </div>
      ) : null}

      {error ? (
        <p
          className="bg-destructive/10 text-destructive border-destructive/20 mt-3 rounded-md border px-3 py-2 text-sm"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask();
        }}
        className="mt-4 space-y-3"
      >
        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Например: почему упал жим?"
          rows={2}
          maxLength={500}
          disabled={streaming}
          aria-label="Вопрос тренеру по разбору"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void ask();
            }
          }}
          className="resize-none"
        />
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={streaming || question.trim().length === 0}
        >
          {streaming ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Тренер думает…
            </>
          ) : (
            <>
              <Send className="size-4" />
              Спросить
            </>
          )}
        </Button>
      </form>
    </section>
  );
}
