"use client";

import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  TECHNIQUE_VIDEO_MAX_BYTES,
  TECHNIQUE_VIDEO_MAX_MB,
  TECHNIQUE_VIDEO_MIME,
} from "@/lib/domain/ai/video-technique";

const sizeError = "Ролик превышает лимит загрузки. Выберите MP4 меньшего размера.";

const errorMessages: Record<string, string> = {
  invalid_video: "Не удалось прочитать MP4. Выберите другой файл.",
  subscription_required: "Разбор видео доступен с подпиской Pro.",
  ai_rate_limited: "Слишком много запросов. Попробуйте через минуту.",
  unauthorized: "Войдите в аккаунт, чтобы разобрать видео.",
};

export function VideoTechniquePanel({ workoutId, exercises }: {
  workoutId: string;
  exercises: { id: string; name: string }[];
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const formData = new FormData(event.currentTarget);
    const video = formData.get("video");
    const exerciseId = formData.get("exerciseId");
    setError("");
    setAnalysis("");
    if (!(video instanceof File) || !video.size || !/\.mp4$/i.test(video.name)) {
      setError("Выберите ролик в формате MP4.");
      return;
    }
    if (video.size > TECHNIQUE_VIDEO_MAX_BYTES) {
      setError(sizeError);
      return;
    }
    if (typeof exerciseId !== "string" || !exerciseId) return;

    setPending(true);
    try {
      const query = new URLSearchParams({ workoutId, exerciseId, requestId: crypto.randomUUID() });
      const response = await fetch(`/api/ai/video-technique?${query}`, {
        method: "POST",
        headers: { "Content-Type": TECHNIQUE_VIDEO_MIME },
        body: video,
      });
      if (response.status === 413) {
        setError(sizeError);
        return;
      }

      const data = await response.json();
      if (response.ok && typeof data.analysis === "string") {
        setAnalysis(data.analysis);
      } else {
        setError(errorMessages[data.error] ?? data.message ?? "Не удалось разобрать ролик. Попробуйте ещё раз.");
      }
    } catch {
      setError("Не удалось разобрать ролик. Попробуйте ещё раз.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="bg-card border-border mt-6 space-y-3 rounded-2xl border p-5">
      <h2 className="font-serif text-2xl font-normal tracking-tight">Разбор техники по видео</h2>
      <p className="text-muted-foreground text-sm">
        Снимите один подход так, чтобы было видно движение целиком. Формат MP4, до {TECHNIQUE_VIDEO_MAX_MB} МБ.
      </p>
      <form onSubmit={submit} onChange={() => { setAnalysis(""); setError(""); }}>
        <fieldset disabled={pending} className="space-y-3">
          <label className="block space-y-1 text-sm">
            <span>Упражнение</span>
            <select name="exerciseId" className="bg-background border-input block h-9 w-full rounded-md border px-3">
              {exercises.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span>Видео подхода</span>
            <Input name="video" type="file" accept={`${TECHNIQUE_VIDEO_MIME},.mp4`} required />
          </label>
          <p className="text-muted-foreground text-xs">
            При отправке AITUNNEL и Alibaba получают ролик для анализа. Fitness AI не сохраняет видео и ответ.
          </p>
          <Button type="submit">{pending ? "Разбираем видео…" : "Разобрать технику"}</Button>
        </fieldset>
      </form>
      {pending && <p role="status" className="sr-only">Видео отправлено на анализ</p>}
      {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
      {analysis && <p role="status" className="whitespace-pre-wrap text-sm leading-relaxed">{analysis}</p>}
    </section>
  );
}
