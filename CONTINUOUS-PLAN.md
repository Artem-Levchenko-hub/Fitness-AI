# CONTINUOUS-PLAN — Библиотека + Тренировочные системы + адаптация на месте

> Драйвер автономной рутины. Гоню фазы по порядку, гейт между ними. Не спрашиваю
> подтверждения — гейт (typecheck/build/test) и есть чекпоинт. Ветка: `feat/library-programs`.

## North star (зафиксирован, не дрейфовать)

Пользователь в `/templates` видит вход **«Библиотека»** с готовыми программами
(тренировочными системами). Свои одиночные шаблоны может **обернуть в систему**.
Программа, скопированная из библиотеки, **меняется на месте** после первого прохода:
тренер правит вес и повторы прямо в том же шаблоне-дне, изредка свапает упражнение.

### 3 зафиксированных решения (owner: «делай по-твоему»)

1. **Библиотека = копируется к юзеру.** Каталог неизменен (TS-данные, не строки БД).
   Прогресс — у каждого свой, на его копии.
2. **Адаптация на месте — только для программных шаблонов** (`programId != null`).
   Одиночные шаблоны не трогаю (остаётся «следующая тренировка» новым шаблоном).
3. **Свап упражнения** — только при подтверждённом застое (`detectStagnation`, streak ≥ 3)
   и наличии не-застойной замены на ту же первичную группу. ≤1 свап за адаптацию → редко.

## Архитектурные решения

- **Библиотека — TS-каталог** `lib/domain/programs/library.ts` (прецедент: `lib/domain/cardio/presets.ts`).
  Нет nullable `userId`, R-7 цел, библиотека неизменна by-construction.
- **1:N, не M2M.** Программа → много `workout_templates` (дней). Шаблон-день принадлежит
  одной программе (`programId`). Копия из библиотеки = свои строки шаблонов у юзера.
- **`programId` ON DELETE SET NULL** — удаление программы отвязывает дни в standalone (не теряем данные).
- **Идемпотентность адаптации** — колонка `workout_templates.lastAdaptedWorkoutId`
  (а не отдельная таблица-лог; YAGNI). Реплей с тем же workoutId → no-op.
- **Переиспользуем** `buildNextTemplateItems` (чистый домен) как есть; адаптация = merge его
  результата в существующие `template_exercises` (та же позиция/упражнение) + опц. свап.

## Фазы и гейт

- [x] **Ф1 — Схема + миграция.** ✅ `training-programs.ts` + 3 колонки + relations + index export.
      `0021_fearless_leopardon.sql` (additive: CREATE TABLE + 3 ADD COLUMN, без DROP). typecheck чист.
      ⚠️ `pnpm db:migrate` НЕ запущен (реальная БД, домен owner) — применить при деплое.
- [x] **Ф2 — Домен + репы (TDD).** ✅ Каталог 6 программ (`library.ts`) + `adapt.ts`
      (mergeProgressionIntoItems, pickSubstitute, buildInPlaceAdaptation) + тесты (14 зелёных,
      slug-страховка). `training-programs.repo.ts` (copy/wrap/list/getWithDays/delete/adaptInPlace
      + оркестратор adaptProgramDayAfterWorkout, реюз exerciseSetHistory+detectStagnation).
- [x] **Ф3 — Server actions + врезка в finish.** ✅ `training-programs.ts`
      (copyFromLibraryAction, wrapTemplatesAction, deleteProgramAction). `finishWorkoutCore`:
      programId → in-place адаптация, иначе старый trainer-шаблон. typecheck + 907 тестов зелёные.
- [x] **Ф4 — UI.** ✅ `/library`, `/library/[slug]`, `/programs/[id]`, `/programs/new`,
      врезка «Библиотека»+«Мои системы»+«Собрать» в `/templates`; loading/error (R-37);
      use-program-button + program-wrap-builder. typecheck + lint + build чисты.
- [~] **Финал.** typecheck+lint+build+test зелёные; коммит на ветке.
      ⚠️ Скриншоты + e2e заблокированы: миграция 0021 не применена к БД (домен owner) —
      приложение упадёт на `training_programs` пока `pnpm db:migrate` не выполнен.

## Ловушки (из памяти)

- Cyrillic-путь `C:\Портфолио` — латинская `o` ломает. cwd уже = репо → git/pnpm без `-C`/пути.
- `git commit -m` inline here-string калечит msg → `git commit -F tempfile`.
- Vitest `@/` alias для новых файлов — если падает import, добавить explicit resolve.alias в vitest.config.
- Zod для LLM JSON — `.nullish()` не `.optional()` (тут не LLM, но если трону trainer-схему — помнить).
- Push: `git push origin HEAD:master` (имя epic-ветки из SKILL устаревает → non-ff). НО push только по команде owner.
- `prompts.ts` — незакоммиченный WIP owner («тренер просто»). Не сбрасывать. Если Ф4 трону trainer-prompt — дописывать, не перетирать.

## Итерация 2 — рестракт (owner feedback)

Шаблоны = только мои; системы уехали в Библиотеку. Модель «полка vs активна»
(`training_programs.activatedAt`, миграция 0022): система на полке в Библиотеке,
«Начать тренироваться» активирует → её дни появляются в `/templates`
(`listTemplates` фильтрует дни неактивных систем). copy-from-library → на полке;
обёртка своих → сразу активна. Trainer/круговые/кардио остались в Шаблонах.
Гейты зелёные (typecheck+lint+build+907 тестов). Commit 655aacc.

## Прогресс-лог

- INIT: recon 6 агентов готов; модель финализирована; ветка `feat/library-programs`; план записан.
- Итер.1: фичи Ф1–Ф4 + финал, commit 7917701.
- Итер.2: рестракт «полка vs активна», миграция 0022, commit 655aacc.
