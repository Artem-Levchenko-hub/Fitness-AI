@AGENTS.md

# Fitness SaaS — трекер силовых тренировок с AI-анализом

**Type:** SaaS на продажу. Self-hosted на собственном сервере владельца. Личное использование тоже (владелец — первый пользователь).

**Strategic role:** in-house продукт под подписку. Связан с экосистемой Innertalk (тот же сервер, тот же домен второго уровня `lead-generator.ru`).

## Stack

- **Framework:** Next.js 16 (App Router, Turbopack, Cache Components)
- **Language:** TypeScript strict
- **UI:** Tailwind CSS v4 + shadcn/ui (new-york) + Lucide + Framer Motion
- **State:** TanStack Query v5 (server) + Zustand (только активная тренировка)
- **Forms:** React Hook Form + Zod
- **Auth:** Auth.js v5 (NextAuth) + Drizzle adapter + Resend (magic-link email)
- **DB:** PostgreSQL 15 (локальный, не Supabase) + Drizzle ORM (postgres-js)
- **AI:** Vercel AI SDK + DeepSeek (OpenAI-compatible endpoint), streaming
- **Billing:** ЮKassa REST API (пополнения, чеки, сохранённый способ оплаты,
  автопродление, возвраты). Legacy Stripe-поля остаются только для совместимости
  старой схемы.
- **Charts:** Recharts
- **PWA:** Serwist
- **Deploy:** pm2 + nginx reverse proxy + certbot — на `app.lead-generator.ru` (170.168.72.200)
- **Tests:** Vitest (unit/domain/repos) + Playwright (E2E + visual regression)

## Commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Next dev server (Turbopack) |
| `pnpm build` | Production build |
| `pnpm start` | Run production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest run |
| `pnpm test:watch` | Vitest watch |
| `pnpm e2e` | Playwright E2E |
| `pnpm db:generate` | Generate migrations from schema |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:push` | Push schema to dev DB (без миграций) |
| `pnpm db:studio` | Drizzle Studio |
| `pnpm db:seed` | Seed system exercises |

**Перед merge:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test` локально. Lefthook гоняет typecheck+lint в pre-commit.

## Domain glossary (использовать в коде, комментариях, копирайте)

- **User / Пользователь** — атлет, использует приложение для трекинга своих тренировок.
- **Exercise / Упражнение** — атомарная единица: жим лёжа, присед, тяга. Бывает system (preseeded) и custom (user-owned).
- **MuscleGroup / Группа мышц** — chest, back_lats, glutes, quads, hamstrings и т.д. Связь с Exercise через primary + secondary.
- **WorkoutTemplate / Шаблон** — предзаготовка тренировки: упорядоченный список упражнений с целевыми параметрами.
- **Workout / Тренировка** — выполненная сессия (instance шаблона или ad-hoc).
- **WorkoutSet / Подход** — один подход в упражнении: вес (kg), повторения, RPE, реальный отдых, тип (working/warmup/drop/failure).
- **RestTimer / Таймер отдыха** — между подходами, замеряет реальный rest.
- **PR / Personal Record / Рекорд** — лучший вес × повторения за всю историю упражнения.
- **1RM / One-Rep Max** — оценка максимума на 1 повторение (Epley/Brzycki формулы).
- **Volume / Объём** — суммарный тоннаж (вес × повторения) за тренировку или период.
- **MicroCycle / Микроцикл** — неделя тренировок (ISO week).
- **ExerciseNote / WorkoutNote / CycleNote** — markdown-заметки. Source = manual или auto-generated. AI читает их целиком при анализе ("второй мозг" по Karpathy).
- **AiAnalysis / AI-анализ** — результат DeepSeek на завершённую тренировку.

## Critical concerns

1. **Self-hosted, не Vercel/Supabase.** Все managed-зависимости заменены: Auth.js вместо Supabase Auth, локальный Postgres вместо Supabase managed, pm2+nginx вместо Vercel, локальный Redis (опционально) вместо Upstash, node-cron / systemd timer вместо Vercel Cron.
2. **Innertalk Messenger живёт на том же сервере на 80/443.** Не трогать его nginx config — наш subdomain `app.lead-generator.ru` добавляется отдельным server block. Наша БД — отдельная, не share с Innertalk.
3. **No RLS** (нет Supabase). Access control реализуем через Data Access Layer: все repo-функции принимают `userId` и фильтруют запросы. Никогда не достаём данные без явного userId. См. R-7.
4. **DeepSeek timeout & circuit breaker** (R-32, R-33). 30s timeout через AbortSignal, после 3 fails подряд — fallback "анализ временно недоступен". Не блокирует тренировки.
5. **ЮKassa webhook не является источником истины.** Принимать из тела только
   тип события и ID, затем делать server-to-server GET, сверять сумму/RUB/
   metadata/test-mode и применять settlement транзакционно.
6. **Markdown-заметки = single source of truth для AI-контекста.** Не кешировать агрегаты в JSON. AI получает заметки целиком.
7. **Animation perf.** Активная тренировка — 60 fps на средних телефонах (тестировать DevTools 4× CPU throttle). Framer Motion respects prefers-reduced-motion.
8. **Mobile-first.** Тапы ≥56px для критичных действий (R-41). Bottom tab bar в (app) layout. iPhone SE как baseline (375×667).

## Architecture rules (project-specific)

- **app/(marketing)** — публичный лендинг + pricing. SSG-friendly.
- **app/(auth)** — login, verify (magic link callback).
- **app/(app)** — приватное под `proxy.ts` auth check.
- **app/api/** — Route Handlers для AI streaming, ЮKassa, health и cron
  triggers. Остальные мутации по возможности остаются Server Actions.
- **lib/domain/** — pure TS, нет imports из db/auth/stripe/deepseek (R-7).
- **lib/repos/** — adapters: принимают `userId` и Drizzle `db`. Все queries фильтруют по userId.
- **server/actions/** — Server Actions, импортируют repos + auth() helper.
- **components/ui/** — shadcn/ui primitives.
- **components/app/** — domain-aware компоненты (SetInput, RestTimer, ActiveWorkoutPanel).
- **components/marketing/** — лендинг блоки.

## Test strategy

- **Domain (lib/domain/):** Vitest, чистые функции (1RM расчёт, PR-detection, volume aggregation).
- **Repos:** integration через test-БД (Postgres в Docker для CI).
- **Server Actions:** integration с test-БД.
- **E2E (Playwright):** signup → создать шаблон → выполнить тренировку → AI-анализ появился → виден в истории.
- **Visual regression:** `toHaveScreenshot()` для главных экранов (dashboard, activeWorkout, stats).

## Apply from `code-canon`

- **Always:** 10 codex rules.
- **R-7 (deps direction):** `lib/domain/` чистый.
- **R-29 (sane FK vs polymorphic):** заметки в трёх отдельных таблицах с FK.
- **R-31 (outbox):** AI-задачи через `ai_jobs` таблицу + node-cron worker.
- **R-32/33 (safety):** timeout + circuit breaker для DeepSeek в `lib/safety/`.
- **R-36 (design tokens):** все цвета и spacing — в `globals.css` через CSS vars + Tailwind `@theme`. Никакого hex в className.
- **R-37 (4 states):** Loading / Empty / Error / Loaded для каждого экрана с данными.
- **R-39 (keyboard):** Tab через SetInput weight→reps→RPE.
- **R-41 (contrast & taps):** контраст AA минимум, тапы ≥56px, не только цвет для статусов.

## Never

- Импортить `next-auth`, `db`, `yookassa`, `stripe`, `deepseek` в `lib/domain/`.
- Запрашивать данные из БД без явного `userId` (нет RLS — мы сами защищаем).
- Использовать `cookies()`, `headers()`, `params` без `await` (Next.js 16 — все async).
- Использовать `middleware.ts` (Next.js 16 → `proxy.ts`).
- Доверять телу webhook ЮKassa без повторного GET объекта у провайдера.
- Хранить DeepSeek/Stripe/Resend ключи в client-side env (`NEXT_PUBLIC_*`).
- Класть hex-код в `className` (`text-[#abc]`) — использовать tokens из `@theme`.
- Push to main без локального `pnpm build`.
- Делать `sudo` команды на сервере без явной директивы пользователя.
- Трогать nginx config Innertalk на 80/443 — мы добавляем server block для `app.lead-generator.ru` отдельным файлом.
