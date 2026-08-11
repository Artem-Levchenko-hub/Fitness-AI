"use client";

import { CheckCircle2, Loader2, Send, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type Props = {
  workoutId: string;
  workoutName: string;
  initialMessages: ChatMessage[];
};

export function CoachChat({ workoutId, workoutName, initialMessages }: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // autoscroll to bottom on new content
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  async function send(userText: string) {
    const trimmed = userText.trim();
    if (!trimmed || streaming) return;

    const clientMessageId = crypto.randomUUID();
    const next: ChatMessage[] = [
      ...messages,
      { id: clientMessageId, role: "user", content: trimmed },
    ];
    setMessages(next);
    setInput("");
    setError(null);
    setStreaming(true);

    // Push empty assistant placeholder which streams fill
    setMessages((prev) => [
      ...prev,
      { id: `pending-${clientMessageId}`, role: "assistant", content: "" },
    ]);

    try {
      const res = await fetch("/api/ai/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workoutId,
          clientMessageId,
          message: trimmed,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        setError(text || `Ошибка ${res.status}`);
        // remove placeholder
        setMessages((prev) => prev.slice(0, -1));
        setStreaming(false);
        return;
      }

      if (!res.body) {
        setError("Пустой ответ от коуча");
        setMessages((prev) => prev.slice(0, -1));
        setStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        acc += chunk;
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = {
            id: `pending-${clientMessageId}`,
            role: "assistant",
            content: acc,
          };
          return copy;
        });
      }
      const tail = decoder.decode();
      if (tail) {
        acc += tail;
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = {
            id: `pending-${clientMessageId}`,
            role: "assistant",
            content: acc,
          };
          return copy;
        });
      }
      if (!acc.trim()) {
        setError("Коуч не вернул ответ. Повторите отправку.");
        setMessages((prev) => prev.slice(0, -1));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка соединения");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setStreaming(false);
    }
  }

  async function finalizeAndExit() {
    if (messages.length === 0 || finalizing) return;
    setFinalizing(true);
    try {
      const res = await fetch("/api/ai/coach/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workoutId, messages }),
      });
      if (!res.ok) {
        const t = await res.text();
        setError(`Не удалось сохранить итог: ${t}`);
        setFinalizing(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
      setFinalizing(false);
    }
  }

  const isFirstMessage = messages.length === 0;

  return (
    <div className="space-y-4">
      <div
        ref={scrollRef}
        className="bg-card border-border max-h-[60vh] min-h-[180px] space-y-4 overflow-y-auto rounded-2xl border p-5"
      >
        {isFirstMessage ? (
          <FirstMessageHint workoutName={workoutName} />
        ) : (
          messages.map((m) => (
            <Message key={m.id} role={m.role} content={m.content} />
          ))
        )}
      </div>

      {error ? (
        <p
          className="bg-destructive/10 text-destructive border-destructive/20 rounded-md border px-3 py-2 text-sm"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="space-y-3"
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            isFirstMessage
              ? "Расскажи коучу: как прошло, что чувствовал, есть ли вопросы…"
              : "Ответ коучу"
          }
          rows={3}
          maxLength={2000}
          disabled={streaming || finalizing}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              send(input);
            }
          }}
          className="resize-none"
        />

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="submit"
            size="lg"
            className="flex-1"
            disabled={streaming || finalizing || input.trim().length === 0}
          >
            {streaming ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Коуч думает…
              </>
            ) : (
              <>
                <Send className="size-4" />
                {isFirstMessage ? "Получить анализ" : "Отправить"}
              </>
            )}
          </Button>

          {messages.length > 0 ? (
            <Button
              type="button"
              size="lg"
              variant="outline"
              onClick={finalizeAndExit}
              disabled={streaming || finalizing}
            >
              {finalizing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Сохраняем…
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" />
                  Завершить
                </>
              )}
            </Button>
          ) : null}
        </div>

        <p className="text-muted-foreground/70 text-xs">
          Коуч помнит все предыдущие тренировки и заметки. Ctrl/⌘ + Enter —
          отправить.
        </p>
      </form>
    </div>
  );
}

function FirstMessageHint({ workoutName }: { workoutName: string }) {
  return (
    <div className="space-y-3 text-center">
      <div className="bg-primary/10 text-primary mx-auto flex size-10 items-center justify-center rounded-full">
        <Sparkles className="size-5" />
      </div>
      <p className="text-foreground text-sm leading-relaxed">
        Коуч готов проанализировать «{workoutName}». Напишите пару строк о
        самочувствии и нажмите «Получить анализ» — он посмотрит на эту
        тренировку в контексте всей вашей истории.
      </p>
    </div>
  );
}

function Message({
  role,
  content,
}: {
  role: "user" | "assistant";
  content: string;
}) {
  const isUser = role === "user";
  return (
    <div className={cn("flex flex-col", isUser ? "items-end" : "items-start")}>
      <p
        className={cn(
          "text-muted-foreground text-[10px] font-medium tracking-wide uppercase",
          isUser ? "pr-1" : "pl-1",
        )}
      >
        {isUser ? "Вы" : "Коуч"}
      </p>
      <div
        className={cn(
          "mt-1 max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-muted text-foreground rounded-tl-sm",
        )}
      >
        {content || (
          <span className="text-muted-foreground inline-flex items-center gap-1.5">
            <Loader2 className="size-3 animate-spin" />
            пишу…
          </span>
        )}
      </div>
    </div>
  );
}
