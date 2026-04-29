export default function HomePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 py-12">
      <div className="bg-pr/10 text-pr inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium">
        <span className="size-1.5 rounded-full bg-current" />
        Phase 0 · фундамент
      </div>

      <h1 className="text-balance text-center text-5xl font-semibold tracking-tight md:text-6xl">
        Fitness SaaS
      </h1>

      <p className="text-muted-foreground max-w-md text-balance text-center text-lg">
        Трекинг силовых тренировок с AI-анализом прогресса. Шаблоны, подходы,
        связанные заметки — и DeepSeek, который читает их целиком.
      </p>

      <p className="text-muted-foreground/60 mt-8 text-xs">
        Сборка скелета. Авторизация и приложение появятся в следующих фазах.
      </p>
    </main>
  );
}
