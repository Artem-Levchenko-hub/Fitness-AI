import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import { getSharedFriendTemplate } from "@/lib/repos/friend-templates.repo";

export const metadata: Metadata = { title: "Шаблон друга" };

export default async function FriendTemplatePage({ params }: {
  params: Promise<{ friendId: string; format: string; templateId: string }>;
}) {
  const { friendId, format, templateId } = await params;
  const user = await requireUser();
  const template = await getSharedFriendTemplate(user.id, friendId, format, templateId);
  if (!template) notFound();
  const friendName = template.friend.name?.trim() || template.friend.email;

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
        <Link href={`/friends/${friendId}`}><ChevronLeft className="size-4" aria-hidden="true" />К профилю друга</Link>
      </Button>
      <header className="mb-6">
        <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">Шаблон друга · Только просмотр</p>
        <h1 className="font-serif mt-1 text-2xl font-normal tracking-tight break-words md:text-3xl">{template.name}</h1>
        <p className="text-muted-foreground mt-2 text-sm break-words">{friendName}</p>
        {template.description ? <p className="text-muted-foreground mt-3 text-sm whitespace-pre-wrap break-words">{template.description}</p> : null}
        <p className="text-muted-foreground mt-3 text-xs leading-relaxed">{template.summary.join(" · ")}</p>
      </header>
      {template.exercises.length > 0 ? (
        <section aria-label="Упражнения шаблона">
          <h2 className="mb-3 text-sm font-semibold">Упражнения</h2>
          <ol className="space-y-2">
            {template.exercises.map((exercise, index) => (
              <li key={exercise.id} className="bg-card border-border flex items-start gap-3 rounded-xl border p-4">
                <span className="text-muted-foreground bg-muted flex size-7 shrink-0 items-center justify-center rounded-full text-xs tabular-nums">{index + 1}</span>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold break-words">{exercise.name}</h3>
                  <p className="text-muted-foreground mt-1 text-xs leading-relaxed tabular-nums">{exercise.target}</p>
                  {exercise.notes ? <p className="text-muted-foreground mt-2 text-xs whitespace-pre-wrap break-words">{exercise.notes}</p> : null}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      {template.blocks.length > 0 ? (
        <section aria-label="Интервалы кардио">
          <h2 className="mb-3 text-sm font-semibold">Интервалы</h2>
          <ol className="space-y-2">
            {template.blocks.map((block, index) => (
              <li key={index} className="bg-card border-border flex items-center justify-between gap-3 rounded-xl border p-4 text-sm">
                <span>{block.label}</span><span className="shrink-0 tabular-nums">{block.durationSec}с</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      {template.exercises.length === 0 && template.blocks.length === 0 ? <p className="text-muted-foreground text-sm">В этом шаблоне пока нет упражнений.</p> : null}
    </main>
  );
}
