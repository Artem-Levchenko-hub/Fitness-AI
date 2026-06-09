# Fitness SaaS — Epic: AI-разбор v3 + UX + соц (2026-06-09)

**Branch:** `epic/fitness-upgrades` (от `origin/master` @ b8c2eaf). Режим: автономно, один поток.
**Это живой файл** — чеклист внизу. Любая новая сессия: прочитать этот файл → продолжить с первого незакрытого пункта.

## ⏯ RESUME (2026-06-10, после F7 run-1)
- **F7 run-1: общий `trendStatus()` хелпер LIVE** (master `0100b52`): `lib/domain/progression/trend.ts` — pure `TrendStatus` тип + `trendStatus(prev,cur,{epsilon,higherIsBetter})` → improved|regressed|stagnant|new (null prev→new; epsilon dead-zone для float-шума; higherIsBetter для метрик где направление≠прогресс, напр. вес тела) + `TREND_LABEL` (Рост/Регресс/Стагнация/Новое). 12 unit-тестов. DRY: канонический `TrendStatus` теперь single-source — `trainer-structured.ts` + `TrainerResultCard.tsx` импортят его (убрали дубль union-литерала). Аддитивно, без миграции, БЕЗ рантайм-изменений UI (тип стирается). Деплой green, прод здоров (login 200, /stats 307 auth-gate). **Цвет-токены (TREND_TONE) ОТЛОЖЕНЫ** до run-2 (YAGNI: 2-й потребитель появится при графиках; F4 пока держит свою копию). **NEXT: F7 run-2 — `/stats` e1RM-линии (Recharts) + бейдж Рост/Стагнация/Регресс через `trendStatus`+общий TREND_TONE.**
- Runtime-verify хелпера отложен на run-2 (хелпер ещё не подключён ни к одному UI — нечего кликать; typecheck+build+24 теста зелёные = доказательство корректности).
- **Recharts API (Context7, v3):** `ResponsiveContainer width="100%" height={N}` + `LineChart`/`ComposedChart`; `accessibilityLayer` уже true по умолчанию; цвет линии через `stroke` (SVG — нельзя Tailwind-класс напрямую; читать значение CSS-var токена в JS, R-36); split-color по значению через `linearGradient gradientUnits="userSpaceOnUse"`.

## ⏯ RESUME (2026-06-10, после F8-B run-2)
- **F8-B стрим разбора ПОЛНОСТЬЮ LIVE** (master `ab8fcd6`): run-1 endpoint + run-2 клиент. On_demand-заход на `/workouts/[id]/trainer` теперь генерит разбор inline+стримом (без cron/poll/перезахода), цветные дельты F4 сохранены. Verified на проде.

## ⏯ RESUME (2026-06-09, после деплоя F1–F3)
- **origin/master `b360d3f` задеплоен на прод (live).** F1 (удаление) + F2 (числовой ввод) + F3 (самочувствие) + прод-хотфиксы (trainer prompt v2, RAG в cron) — на `app.lead-generator.ru`.
- **F2 проверен на проде в рантайме:** `06→6`, `60→60`, инпуты = NumberField (`type=text`+`inputMode`). PWA на реальном телефоне — за владельцем.
- **F1/F3 задеплоены + зелёные** (typecheck/lint/build/lefthook). Полный клик-тест — в раунде F4 (там всё равно нужен workout-flow).
- **Доступ:** GitHub-токен зашит в `origin` URL → `git push origin <branch>:master` работает. Деплой: `ssh kanavto-vps` → `cd /opt/fitness-saas` → `git fetch` → `git reset --hard origin/master` → `pnpm build` → `pm2 reload ecosystem.config.cjs`. **Docker ЛОКАЛЬНО не стартует (WSL)** → verify только на проде: `scripts/issue-session.mjs` (gitignored, на VPS) даёт REFRESH_TOKEN → playwright POST `/api/auth/restore` → залогинен; `--cleanup` удаляет тест-юзера.
- **Готово + LIVE на проде** (master `850506d`): F1 удаление · F2 числовой ввод (полный sweep, 0 `type=number`, verified) · F3 самочувствие · **F4-инкр.1** (exerciseComparisons + цветные дельты `ComparisonRow`) · **F4-инкр.2a** (профиль атлета вес/рост/возраст + история 10 трен ЦЕЛИКОМ set-by-set в `buildTrainerContext`). ИИ уже знает вес 90кг и рассуждает про bodyweight (подтягивания = тело+добавка) из prompt+профиля.
- **NEXT ACTION (продолжить отсюда):** **F8 run-3 — полиш стрима (опц.)** ИЛИ перейти к **F7 графики** (`/stats` + Recharts, `trendStatus` DRY с F4). F8 run-1+run-2 LIVE+verified на проде (master `ab8fcd6`). Возможный полиш run-3: прогресс-бар/скелетон по байтам стрима вместо статичного спиннера; анимация появления карточки; обработка очень долгой генерации (>45с timeout) с явным сообщением. Низкий приоритет — базовый UX уже работает. Рекомендую начать **F7**.
- **Опционально (deferred, low-value):** F4-инкр.2b — `exercises.is_bodyweight` миграция (с `pg_dump`!) для ЧИСЛЕННОЙ эффект.нагрузки. Не критично: ИИ уже рассуждает качественно.
- **Потом:** F7 графики (`/stats` + Recharts, `trendStatus` DRY с F4) · F5 форматы (унифицированный пикер обычная/круговая/EMOM/Tabata/кардио + explainers + расписание/напоминания) · F6 друзья.
- **Компакт-правило владельца:** держать <600к, коммит+деплой каждый инкремент (lossless при авто-компакте). Деплой: `ssh kanavto-vps` → `cd /opt/fitness-saas` → `git fetch && git reset --hard origin/master && pnpm build && pm2 reload ecosystem.config.cjs`.

## Доступ / Деплой (факты)

- **VPS:** `ssh kanavto-vps` → `i48ptgvnis@170.168.72.200`. App: `/opt/fitness-saas`. pm2: `fitness-saas` (порт 3001), `fitness-saas-cron`.
- **Deploy:** ssh → `cd /opt/fitness-saas` → `git pull` → `pnpm install` → `pnpm build` → `pnpm db:migrate` (если новые миграции) → `pm2 reload ecosystem.config.cjs`.
- **НЕ трогать:** pm2-аппы `kanavto`/`site`/`among-irl`, Innertalk на 80/443, чужой nginx. Только наш `app.lead-generator.ru`.
- **GitHub:** `origin` = https://github.com/Artem-Levchenko-hub/Fitness-AI . Push требует свежий токен (`gh auth login`). Fetch — анонимно ок.
- **Login для тестов:** `session.strategy = "database"` → логинимся инъекцией строки в таблицу `session` + cookie в браузере (`__Secure-authjs.session-token` на https). Mailbox НЕ нужен. AUTH_SECRET в `.env.production` на VPS.
- **Local:** docker-compose Postgres + `.env.local`. `pnpm dev` → :3000.

## Цикл на каждую фичу (автономно)

`sequential-thinking` дизайн → Context7 (Next 16 / Drizzle / либы) → код (TDD где логика; 10 правил code-canon; R-7 чистый domain; R-36 токены; R-37 4 состояния; R-41 тапы ≥56px) → `pnpm typecheck && pnpm lint && pnpm build && pnpm test` → commit → push GitHub → deploy VPS → проверка в браузере на аккаунте владельца → удалить тест-данные → отметка в чеклисте.
**Перед каждой prod-миграцией:** `pg_dump` бэкап.

## Фичи и дизайн

### F1 — Удаление тренировок и шаблонов [S]
Server actions `deleteWorkoutAction` / `deleteTemplateAction` → repo с фильтром по `userId` (R-7). Каскад детей (sets/exercises/ai_jobs/notes) — через FK ON DELETE CASCADE или явно. Удаление шаблона НЕ удаляет связанные тренировки (FK → null). UI: destructive-кнопка + confirm-диалог на detail + в списке. После → redirect к списку + toast. Это же — инструмент уборки тест-данных.

### F2 — Числовой ввод [S]
Баг: `<Input type="number">` контролируемый → ведущий `0`, нельзя стереть (`06`/`60`), курсор. Фикс: примитив `NumberField` (`type="text"` + `inputMode="decimal|numeric"` + select-on-focus + санитайз + clamp на blur). Заменить в `SetInput` + ~7 формах (sleep/nutrition/body/profile/topup/template-builder/exercises/cardio). Телефонная цифровая клава гарантированно.

### F3 — Самочувствие перед завершением [S]
Необязательное поле «Как прошло? Самочувствие, боли, энергия» на шаге завершения. Хранить (колонка `feeling_note` на `workouts` ИЛИ WorkoutNote source=manual). Прокинуть в `context-builder` → AI учитывает. Миграция: +колонка.

### F4 — AI-разбор v3 [M] (главная)
- **context-builder:** последние **10 тренировок целиком** (set-by-set), PR, **вес тела + рост** из body_measurements, feeling-note (F3).
- **Взвешенные упражнения:** считать эффективную нагрузку = вес тела + добавка (подтягивания/брусья). Падение добавки 20→10 кг при 90 кг = <10% тотала — prompt/контекст должны рассуждать в % тотала. Нужен флаг bodyweight у exercise.
- **Promt:** проще язык, глубже «почему», ссылки на канон **И на прошлые цифры атлета**.
- **UI сравнения:** структурный вывод per-exercise `{prevTopSet, curTopSet, deltaReps, deltaWeight, status: improved|regressed|stagnant|new}` → цветовое кодирование: рост — зелёным, регресс — серо-красным (мягко), стагнация — серым. «5→6» подсвечено.

### F5 — Кардио + единый поток форматов [L]
Master уже имеет cardio + circuits (круговые). Объединить вход «создать шаблон» → пикер формата: **обычная / круговая / EMOM / Tabata / кардио** (+ короткий explainer per формат до создания). EMOM/Tabata — интервальные (расширить circuit schema enum `format`). Кардио-типы: бег/вел/плавание/… Расписание: дни недели ИЛИ интервал → push-напоминания (cron уже есть). Неяркие подписи формата у названий. Всё в одном списке.

### F6 — Друзья/соц [L]
Greenfield. Schema `friendships(userId, friendId, status: pending|accepted)`. Добавить по email/коду. Смотреть тренировки друзей (read-only, приватность). Делиться разборами (share-флаг/ссылка на AiAnalysis). Privacy-настройки. UI: страница друзей, профиль друга, share на разборе.

### F7 — Наглядные графики прогресса [M]
Дашборд на `/stats` (Recharts уже есть). Очень наглядно: рост — зелёным, стагнация — серым, регресс — серо-красным (мягко). Графики: e1RM по ключевым упражнениям во времени (линия + цвет тренда + бейдж Рост/Стагнация/Регресс), объём по неделям (бар), вес тела (линия). Общий хелпер `trendStatus(prev, cur)` + цвет-токены — DRY с F4 (та же семантика тренда).

### F8 — Стриминг разбора в реальном времени [M]
Сейчас trainer-разбор async (ai_jobs + cron) → надо перезаходить, чтобы увидеть (плохо чувствуется). Сделать live: на `/workouts/[id]/trainer` стримить генерацию (coach route уже умеет `toTextStreamResponse`). При заходе без готового анализа — запустить стрим прямо в запросе (text-stream) + сохранить результат в конце. Без перезахода.

## Чеклист (живой)

### F0 — Foundation
- [x] fetch + база = origin/master; epic-ветка; stash эксперимента
- [x] .gitignore hardening (.claude/.omc/dev-login)
- [x] spec/checklist (этот файл)
- [x] pnpm install ok; build/typecheck/lint/test зелёные на master (b8c2eaf)
- [x] vitest настроен (config + первые тесты)
- [x] GitHub push-токен (юзер дал PAT) → gh настроен + push
- [ ] login-helper (session JWT) — Docker local НЕ стартует → verify на проде

### F1 — Удаление [done, prod-verify pending]
- [x] repo: deleteWorkout (userId-filter, каскад); deleteTemplate уже был
- [x] actions + revalidate (deleteWorkoutAction)
- [x] UI: ConfirmDeleteButton (диалог) на workout(active+completed) + template
- [x] typecheck/lint/build зелёные (integration-тесты отложены — нет test-DB)
- [x] push (b360d3f) → deploy на прод → F1 UI live (полный клик-тест — в раунде F4)

### F2 — Числовой ввод [core done]
- [x] NumberField + sanitizeNumeric/clampNumber + 12 unit-тестов
- [x] замена в SetInput (вес/повторы/RPE) + template-builder (NumField/RangeField)
- [x] sweep ВСЕХ форм: circuit-builder («Кругов»!), cardio (custom/emom/active), sleep, nutrition, body, topup, profile, active-circuit — **0 type=number осталось** (grep=0)
- [x] NumberField теперь и uncontrolled (FormData-формы) + общий LabeledNumberField (DRY)
- [x] verify на проде runtime (06→6, 60→60) ✓ · PWA на телефоне — за владельцем

### F3 — Самочувствие [done, prod-verify pending]
- [x] хранение: workout_note source=manual (миграция не нужна — таблица есть)
- [x] UI textarea на завершении + saveManualWorkoutNote
- [x] context-builder уже читает recentWorkoutNotes → AI увидит
- [x] задеплоено на прод · полный клик-тест заметки → в раунде F4

### F4 — AI-разбор v3 [инкрементами]
- [x] инкр.1: `exerciseComparisons` в structured (trainer-structured + JSON_SHAPE + prompt) + UI цветовых дельт (TrainerResultCard `ComparisonRow`: рост зелёный↑ / стагнация серый= / регресс мягко-красный↓, «60×5 → 60×6» с подсветкой). Backward-compat (optional/default([])). typecheck+test зелёные
- [x] инкр.2a (БЕЗ миграции): context-builder += «Профиль атлета» (вес тела/рост/возраст + bodyweight-подсказка) в buildTrainerContext; история 8→10; прошлые трен set-by-set целиком (formatWorkout вместо compact)
- [ ] инкр.2b (МИГРАЦИЯ — `pg_dump` ПЕРЕД!): `exercises.is_bodyweight` boolean + `pnpm db:generate` + применить на prod по ssh; seed-флаг (подтягивания/брусья/отжимания); context-builder — численная эффект.нагрузка = вес тела + добавка
- [ ] verify на реальной истории (дельты появятся при следующем разборе завершённой тренировки)

### F5 — Форматы [L]
- [ ] schema: format enum + schedule
- [ ] unified пикер + explainers (EMOM/Tabata/…)
- [ ] EMOM/Tabata билдеры
- [ ] расписание по дням/интервалу + push-напоминания
- [ ] список с подписями формата + verify

### F6 — Друзья [L]
- [ ] schema friendships + privacy
- [ ] add/accept flow
- [ ] просмотр тренировок друга
- [ ] шеринг разбора
- [ ] verify

### F7 — Графики прогресса [M]
- [x] **run-1: `trendStatus()` хелпер** (master `0100b52`) — `lib/domain/progression/trend.ts`: `TrendStatus` тип + `trendStatus(prev,cur,{epsilon,higherIsBetter})` + `TREND_LABEL`; 12 unit-тестов; DRY канонический `TrendStatus` (trainer-structured + TrainerResultCard импортят). Цвет-токены `TREND_TONE` отложены до run-2 (YAGNI — 2-й потребитель = графики). Аддитивно, deployed, прод здоров. Runtime-verify на run-2 (хелпер ещё не в UI).
- [ ] run-2 /stats: e1RM-линии (Recharts) с цветом тренда + бейдж Рост/Стагнация/Регресс через `trendStatus`; вынести общий `TREND_TONE` (DRY с F4 TrainerResultCard)
- [ ] объём по неделям (бар), вес тела (линия)
- [ ] verify

### F8 — Стриминг разбора [M] — NEXT, дизайн готов
**Текущий флоу (poll):** `app/(app)/workouts/[id]/trainer/page.tsx` → `requestTrainerOnDemand` (`server/actions/trainer.ts`) → aiJob pending → worker `app/api/cron/process-ai-jobs/route.ts::processJob` (`generateTrainerResponse` = `generateText` + `extractJson` + Zod, т.к. deepseek-thinking не даёт чистый structured) → сохраняет `ai_analyses` (content=md из `renderMarkdown`, resultJson) → `components/trainer/TrainerJobPoller.tsx` поллит `/api/ai/jobs/[id]` 2с. Боль: ожидание/перезаход.

**Развилка (решить + реализовать):**
- **A. live-markdown** (низкий риск): новый `POST /api/ai/trainer/stream` — `buildTrainerContext`+RAG + `streamText({model: aiClient(COACH_MODEL), system: <markdown-prompt>, prompt})` (как `app/api/ai/coach/route.ts`) → `toTextStreamResponse()`; `onFinish` → сохранить `ai_analyses`. Клиент стримит токены live. **Минус:** теряются цветные дельты F4-инкр.1 (markdown вместо structured card).
- **B. live-structured** (`streamObject`): сложно — thinking-модель эмитит reasoning перед JSON, partial-object стрим рвётся. Нужен эксперимент (вырезать thinking, или non-thinking модель для трейнера).
- **✅ ВЫБОР ВЛАДЕЛЬЦА: B** — цветные карточки СОХРАНЯЕМ, генерация inline+стрим (одна генерация, без poll/перезахода).
- **B-план:** новый `POST /api/ai/trainer/stream` (requireUser → `buildTrainerContext`+RAG → `streamText(aiClient(COACH_MODEL), system=TRAINER_SYSTEM_PROMPT+JSON_SHAPE, prompt)`; `onFinish`: `extractJson`+Zod → save `ai_analyses` md+resultJson). Экспортнуть `JSON_SHAPE_INSTRUCTION`/`extractJson` из `lib/ai/trainer-structured.ts`. Клиент `/workouts/[id]/trainer`: на on_demand вместо `TrainerJobPoller` — стрим-консьюмер: live «тренер анализирует…» (анимация/прогресс по стриму), по завершении → `TrainerResultCard` (цветные дельты F4). Poll-путь оставить fallback (push/повторный заход).
- [x] **run-1: endpoint `/api/ai/trainer/stream`** (additive, deployed+verified на проде). `POST` → requireUser → `buildTrainerContext`(on_demand)+RAG → `streamText(aiClient(COACH_MODEL), system=TRAINER_SYSTEM_PROMPT+JSON_SHAPE_INSTRUCTION)` → `toTextStreamResponse`; `onFinish({text,usage})` → `parseTrainerJson`+`renderTrainerMarkdown` → insert `ai_analyses`. Экспортнуты из `trainer-structured.ts`: `JSON_SHAPE_INSTRUCTION`, `extractJson`, `parseTrainerJson`, `renderTrainerMarkdown` (вынесена из cron, cron теперь импортит — поведение идентично; DRY). **Прод-verify (master 2da7220):** unauth POST=307 (guard ✓); authed POST на seeded completed workout → HTTP 200, валидный structured JSON стримом (2402 B / 12s); `onFinish` сохранил ровно 1 `ai_analyses` (overallScore=45, exerciseComparisons=1 → цветные дельты сохранены, md 1339 chars, токены записаны). Тест-данные удалены (--cleanup, FK cascade).
- [x] **run-2: клиент-консьюмер** (LIVE+verified на проде, master `ab8fcd6`). Реализовано: `page.tsx` 3-ходовая развилка — (1) сохранённый `resultJson` есть → `TrainerResultCard` сразу; (2) pending/running/succeeded aiJob есть → `TrainerJobPoller` (fallback, cron-путь); (3) свежий on_demand → новый client `TrainerStreamConsumer`. Консьюмер: `POST /api/ai/trainer/stream`, дренирует ReadableStream РАДИ ПРОГРЕССА (сырой JSON НЕ рендерит — индикатор «Тренер анализирует…» по факту байт), по завершении ретраит `GET /api/ai/trainer/latest?workoutId=` (6×1с) → `TrainerResultCard` (цветные дельты F4). Решение из развилки: выбран вариант **(a)** — новый endpoint `GET /api/ai/trainer/latest` + repo `getLatestTrainerResult(userId, workoutId)` (R-7), серверная Zod-валидация при сохранении. Poll-путь (dashboard `TrainerTrigger` + cron) НЕ тронут. Аддитивно, без миграции. **Прод-verify:** seeded completed workout → on_demand-заход показал «Тренер анализирует…» → через ~30с появился `TrainerResultCard` (overallScore 40/100, exerciseComparisons «Жим лёжа 60×7 new», рекомендации) БЕЗ перезахода; reload → карточка сразу из сохранённого (no re-stream); `ai_analyses count=1` (без дублей). Тест-данные удалены (--cleanup, FK cascade).
