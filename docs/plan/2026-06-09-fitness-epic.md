# Fitness SaaS — Epic: AI-разбор v3 + UX + соц (2026-06-09)

**Branch:** `epic/fitness-upgrades` (от `origin/master` @ b8c2eaf). Режим: автономно, один поток.
**Это живой файл** — чеклист внизу. Любая новая сессия: прочитать этот файл → продолжить с первого незакрытого пункта.

## ⏯ RESUME (2026-06-09, после деплоя F1–F3)
- **origin/master `b360d3f` задеплоен на прод (live).** F1 (удаление) + F2 (числовой ввод) + F3 (самочувствие) + прод-хотфиксы (trainer prompt v2, RAG в cron) — на `app.lead-generator.ru`.
- **F2 проверен на проде в рантайме:** `06→6`, `60→60`, инпуты = NumberField (`type=text`+`inputMode`). PWA на реальном телефоне — за владельцем.
- **F1/F3 задеплоены + зелёные** (typecheck/lint/build/lefthook). Полный клик-тест — в раунде F4 (там всё равно нужен workout-flow).
- **Доступ:** GitHub-токен зашит в `origin` URL → `git push origin <branch>:master` работает. Деплой: `ssh kanavto-vps` → `cd /opt/fitness-saas` → `git fetch` → `git reset --hard origin/master` → `pnpm build` → `pm2 reload ecosystem.config.cjs`. **Docker ЛОКАЛЬНО не стартует (WSL)** → verify только на проде: `scripts/issue-session.mjs` (gitignored, на VPS) даёт REFRESH_TOKEN → playwright POST `/api/auth/restore` → залогинен; `--cleanup` удаляет тест-юзера.
- **Дальше:** F4 (AI-разбор v3) — **Context7 + sequential-thinking обязательно**. Затем F8 (стриминг), F7 (графики), F5 (форматы), F6 (друзья).

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

### F4 — AI-разбор v3 [Context7 + sequential ОБЯЗАТЕЛЬНО]
- [ ] context-builder: 10 трен целиком + вес тела/рост + bodyweight-load + feeling
- [ ] bodyweight-флаг у exercise (schema/seed)
- [ ] структурный вывод сравнения + prompt (проще язык, канон + прошлые цифры)
- [ ] UI цветовых дельт (рост зелёный / стагнация серый / регресс серо-красный)
- [ ] verify на реальной истории

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
- [ ] trendStatus + цвет-токены (DRY с F4)
- [ ] /stats: e1RM-линии с цветом тренда + бейдж Рост/Стагнация/Регресс
- [ ] объём по неделям (бар), вес тела (линия)
- [ ] verify

### F8 — Стриминг разбора [M]
- [ ] trainer live-стрим на /workouts/[id]/trainer (без перезахода)
- [ ] сохранение результата в конце стрима
- [ ] verify
