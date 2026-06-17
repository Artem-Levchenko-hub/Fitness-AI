# Trainer waiting UX + template adaptation lifecycle — design

**Date:** 2026-06-17
**Branch:** `feat/library-programs`
**Status:** awaiting owner review

## Goal

Five owner-requested changes, grouped into two implementation phases:

- **Phase A — Trainer waiting UX** (frontend only, low risk)
  - W1: short curated "book facts" instead of raw RAG chunk dumps
  - W2: animated stickman loader (squat / bench-press, alternating)
  - W3: responsive fix for the "Сегодня нагружено" card
- **Phase B — Template adaptation lifecycle** (schema + repos + actions + UI)
  - W4: untrained system-days leave the Шаблоны list; AI/generated content lives in the Library
  - W5: in-place trainer adaptation for **all strength templates** + "Улучшено тренером" label + sticky revert

Phases are independent and can ship separately. Phase A first (fast, isolated). Phase B is sequenced after, because it carries a DB migration.

## Locked decisions (from brainstorming)

1. **Facts** → curated static set (hand-written, 1–2 sentences, cited to the book), selected by session muscle groups. No LLM summarization, no raw RAG chunk in the filler.
2. **Waiting screen** → stickman hero + one short fact + the existing 3 stages.
3. **Stickman** → alternate squat ↔ bench press. `prefers-reduced-motion` → static mid-pose.
4. **ИИ библиотека** → reuse the existing `/library` hub. Шаблоны keeps the existing Library button. No new top-level route.
5. **Adaptation scope** → all **strength** templates (program-day AND standalone). Circuit/cardio do not adapt (no `templateId`, no target model).
6. **Revert is sticky** → after "Отменить корректировку ИИ тренера", the trainer no longer auto-rewrites that template (`adapt_opt_out = true`) until the user re-enables it.
7. **Snapshot storage** → single JSON column on `workout_templates` (not a history table — YAGNI, only one revert-to-original is needed).

---

## Phase A — Trainer waiting UX

### W1 — Short curated facts

**Problem.** `/api/ai/trainer/insights` returns up to 5 raw Schoenfeld chunks (~1000 chars, often tables). `lib/ai/insight-card.ts` only collapses whitespace — no truncation. `InsightCards.tsx` renders the full chunk → a wall of text.

**Design.**
- New `lib/ai/insight-facts.ts`:
  ```ts
  export type InsightFact = {
    id: string;
    text: string;        // 1–2 sentences, <= 3 rendered lines
    citation: string;    // "Brad Schoenfeld · «Science and Development of Muscle Hypertrophy»"
    muscles: MuscleGroup[]; // empty = general fact (always eligible)
  };
  export const INSIGHT_FACTS: InsightFact[]; // ~25–30 entries
  ```
- New pure domain selector `selectInsightFacts(sessionMuscles, n)` in `lib/domain/` (R-7 clean): rank facts by overlap with session muscle groups, top up with general facts, return `n` (default 3) in a deterministic-but-varied order (vary by index/session, no `Math.random` in domain — caller may pass a seed/offset).
- `InsightCards.tsx`: source facts client-side from the `session` muscle data it already receives. The book-facts carousel renders `InsightFact.text` + `.citation`.
- **Retire the RAG path for the filler only.** Stop calling `/api/ai/trainer/insights` from `TrainerWaiting`. RAG (`retrieveRelevant`, `lib/ai/rag/*`) stays untouched for the actual trainer analysis. The `insights` route + `insight-card.ts` + `insight-query.ts` become dead for the filler — remove the call; delete the now-unused route/helpers in the same PR if nothing else imports them (verify with a usage grep before deleting).
- Safety: still cap rendered height (`line-clamp` / max-height) so a long fact can never wall again.

**Why curated, not RAG.** Chunks are academic tables; truncating them yields garbage ("…to 25 30 to 60 seconds Leg press 3 15…"). Curated facts are instant (no network, no second AI call while the trainer already thinks), always clean, always on-topic.

### W2 — Stickman loader

**Problem.** Waiting UI (`TrainerWaiting.tsx` = `InsightCards` + `TrainerSkeleton` + `TrainerStages`) is text-heavy and generic. Owner wants a domain loader: a stick figure pressing/squatting.

**Design.**
- New `components/trainer/StickmanLoader.tsx` — inline SVG, two poses (squat with barbell, bench press), **alternating** every cycle. Animate with SMIL/CSS only (trainer flow convention is Tailwind/CSS — Framer Motion is available but unused here; keep it consistent).
  - Squat: torso+barbell `translateY` down/up; legs morph (hip drops, knees bend, feet planted).
  - Bench press: lying figure, arms push the bar up/down.
  - Alternate by cycling pose on each loop (CSS keyframe sequence or a small state toggle that does NOT use `Math.random`/`Date.now` at module load).
- `prefers-reduced-motion: reduce` → render a single static mid-rep pose (no animation). The global cascade in `globals.css` already neutralizes CSS animations; for SMIL, gate by not mounting the animated variant when reduced-motion is detected (reuse the `prefersReducedMotion()` pattern from `TrainerStages.tsx`).
- Slot into `TrainerWaiting.tsx` as the hero, above the short fact + stages. Keep the existing `TrainerStages` (Читаю подходы → Сверяюсь с книгой → Пишу разбор).
- Tokens only (R-36): figure stroke = `--color-text-primary` (theme-safe both modes), accent (plates) = primary/success token.

### W3 — Responsive "Сегодня нагружено"

**Problem.** `InsightCards.tsx:~105`: `flex items-center gap-3`, `BodySilhouette` fixed `h-16 w-20`, up to 14 Russian muscle names with no wrap, container `p-5`. Overflows < 480px.

**Design (pure CSS, tokens).**
- Container: `flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3`.
- Silhouette: `h-14 w-16 sm:h-16 sm:w-20 shrink-0`.
- Card padding: `p-4 sm:p-5`.
- Label `<p>`: keep natural wrapping; add `min-w-0` to the text container so it can shrink.
- Verify on iPhone SE (375px) baseline.

---

## Phase B — Template adaptation lifecycle

### Data model (migration 0023)

Add to `workout_templates` (`db/schema/templates.ts`):

| Column | Type | Default | Purpose |
|---|---|---|---|
| `pre_adapt_snapshot` | `jsonb` | null | Original `template_exercises` (serialized array) captured before the FIRST trainer adaptation. Enables revert. |
| `adapted_at` | `timestamptz` | null | When the template was last adapted (for the "Улучшено тренером · <дата>" label). |
| `adapt_opt_out` | `boolean` | `false` | Sticky revert flag. `true` → trainer skips auto-adaptation for this template. |

Reuse the existing `last_adapted_workout_id` (migration 0021, applied) as the "is adapted" + idempotency key.

Snapshot shape = array of `template_exercises` rows minus identity (`exerciseId`, `position`, `targetSets`, `targetRepsMin`, `targetRepsMax`, `targetWeightKg`, `targetRestSeconds`, `notes`). Stored as `jsonb`.

Generate via `pnpm db:generate` → `0023_*.sql`; apply locally with `pnpm db:migrate`. **Prod:** owner applies (deploy is git-bundle/scp, not GitHub-proxy). Migration is additive (3 nullable/defaulted columns) → safe, no backfill.

### W4 — Шаблоны list filter + Library

**Current** (`lib/repos/templates.repo.ts:listTemplates`): returns standalone templates (`programId IS NULL`) + days of **active** systems (`trainingPrograms.activatedAt IS NOT NULL`). Returns `source`, not `programId`/`lastAdaptedWorkoutId`.

**New rule.** A template appears in the Шаблоны list when:
- `programId IS NULL` (standalone — manual or freshly created), **OR**
- `programId IS NOT NULL AND lastAdaptedWorkoutId IS NOT NULL` (a system-day that has been trained at least once).

→ Untrained active-system days drop out of the list. They remain reachable at `/templates/[id]` via the program detail page (`/programs/[id]` links each day → `/templates/[dayId]` → `StartWorkoutButton`). After the first finish, `lastAdaptedWorkoutId` is set and the day appears in Шаблоны. **No new start action needed.**

- Extend `listTemplates` to also select `lastAdaptedWorkoutId` (and keep `source`); apply the filter above in SQL.
- Badge in `templates/page.tsx`: show **"Улучшено тренером"** when `lastAdaptedWorkoutId != null`; otherwise no badge. Remove the old `source === "trainer"` → "Составил тренер" rendering (the standalone trainer-next templates that fed it are retired in W5).
- Library button already exists (`templates/page.tsx:48`) — keep. The `/library` hub already holds "Мои системы" + "Готовые программы"; that is the AI/generated home. No new route.
- **Open verification for the implementer:** the screenshot shows activated system days badged "Составил тренер", but `copyLibraryProgramToUser` sets `source="manual"`. Confirm there is no second path setting `source="trainer"` on system days; the new badge rule keys off `lastAdaptedWorkoutId`, so it is robust regardless — but resolve the discrepancy to avoid surprises.

### W5 — Unified in-place adaptation + revert

**Current finish flow** (`server/actions/workouts.ts:finishWorkoutCore`):
- Program-day template → `adaptProgramDayAfterWorkout` (in-place, idempotent).
- Else (standalone or ad-hoc) → `createTrainerNextTemplate` spawns a NEW "· следующая" template.

**New.** One unified path keyed off `workouts.templateId`:

```
adaptTemplateAfterWorkout(userId, workoutId, performed):
  template = workout.templateId ? load(templateId) : null
  if !template: return null                      // ad-hoc workout → nothing to adapt (no spawn)
  if template.adaptOptOut: return null           // sticky revert → trainer stays out
  if template.lastAdaptedWorkoutId === workoutId: return idempotent no-op
  if template.preAdaptSnapshot == null:          // FIRST adaptation
      template.preAdaptSnapshot = serialize(current template_exercises)
  { items, swap } = buildInPlaceAdaptation(current, performed, substitutes)
  replace template_exercises with items           // existing DELETE+INSERT
  set lastAdaptedWorkoutId = workoutId, adapted_at = now()
```

- Resolve the template via `workouts.templateId` (works for both program-day and standalone — both set `templateId` on start). This replaces the program-binding-by-workoutId lookup inside `adaptProgramDayAfterWorkout`.
- Reuse `buildInPlaceAdaptation` (`lib/domain/programs/adapt.ts`) unchanged, including stagnation detection + single substitute (works per-exercise, program-agnostic).
- Snapshot insertion point: in `adaptProgramTemplateInPlace` (`training-programs.repo.ts:~351`), **before** the `DELETE`, if `preAdaptSnapshot` is null, capture current rows into the column. (Rename the function to reflect it's no longer program-only, e.g. `adaptTemplateInPlace`.)
- **Retire:** `createTrainerNextTemplate`, `trainerTemplateExistsForWorkout` (`templates.repo.ts`), and the else-branch in `finishWorkoutCore`. Keep `buildNextTemplateItems` (still used inside `buildInPlaceAdaptation`). Grep for other callers before deleting.
- Behavioral change to accept: ad-hoc workouts (no `templateId`) no longer auto-spawn a "следующая" template. Manual "save as template" remains available elsewhere.

**Revert.**
- New server action `revertTemplateAdaptationAction(templateId)` (`server/actions/`):
  - Restore `template_exercises` from `preAdaptSnapshot` (DELETE + INSERT from snapshot).
  - Set `adapt_opt_out = true`; clear `last_adapted_workout_id`, `adapted_at`, `pre_adapt_snapshot`.
  - `revalidatePath("/templates")` + the detail path.
  - DAL: action takes `userId`; repo filters by `userId` (R-7, no RLS).
- UI (`app/(app)/templates/[id]/page.tsx`):
  - `getTemplateWithItems` must also return `source`, `lastAdaptedWorkoutId`, `adaptedAt`, `adaptOptOut`, and whether `preAdaptSnapshot` exists.
  - When `lastAdaptedWorkoutId != null`: show banner "Улучшено тренером · <adapted_at>" + a client button "Отменить корректировку ИИ тренера" (confirm dialog → `revertTemplateAdaptationAction`).
  - Optional (nice-to-have, defer): "посмотреть оригинал" preview before reverting.

---

## Data flow (Phase B happy path)

1. User starts a strength workout from template T → `workouts.templateId = T`.
2. User finishes → `finishWorkoutCore` → `adaptTemplateAfterWorkout`.
3. First time: snapshot T's exercises → adapt in place → `lastAdaptedWorkoutId`, `adapted_at` set.
4. Шаблоны list now shows T (if it was a system-day) with "Улучшено тренером".
5. User opens T → banner + "Отменить корректировку ИИ тренера".
6. Revert → exercises restored from snapshot, `adapt_opt_out = true`. Future finishes skip T until re-enabled.

## Error handling / edge cases

- Adaptation is fail-soft (R-10): any error must not break workout finish (preserve existing try/catch around the call).
- Idempotency preserved via `lastAdaptedWorkoutId === workoutId`.
- Revert with null snapshot (shouldn't happen if `lastAdaptedWorkoutId != null`) → guard: no-op + log.
- Circuit/cardio templates: never adapted, always listed (they have no `programId`, no `templateId` link).
- Re-enabling adaptation after sticky opt-out: out of scope for v1 (no UI). Note as follow-up — could be a toggle on the template detail page.

## Testing

- **Domain (Vitest):** `selectInsightFacts` (muscle ranking, top-up, count); `buildInPlaceAdaptation` already covered — add a case asserting snapshot-vs-adapted items differ.
- **Repos (test DB):** `listTemplates` new filter (untrained system-day excluded, trained included, standalone always); snapshot capture on first adapt only; revert restores exact snapshot + sets opt-out; opt-out blocks re-adapt.
- **Action:** `revertTemplateAdaptationAction` ownership (R-7) + revalidation.
- **E2E (Playwright):** finish a strength workout from a template → "Улучшено тренером" appears → open → revert → original restored → next finish does not re-adapt.
- **Visual:** screenshot the new waiting screen (stickman) + responsive "Сегодня нагружено" at 375px and desktop.
- **Reduced motion:** stickman renders static pose under `prefers-reduced-motion`.

## Sequencing

1. **Phase A** (W1 → W2 → W3): no schema, no backend. Ship/verify independently.
2. **Phase B**:
   - 0023 migration (schema columns) → `db:generate` → `db:migrate` local.
   - `listTemplates` filter + badge (W4).
   - Unified `adaptTemplateAfterWorkout` + snapshot + retire spawn path (W5 core).
   - Revert action + template detail UI (W5 revert).
   - Tests + visuals.
3. Owner applies 0023 to prod via bundle/scp deploy.

## Out of scope (v1)

- Re-enabling adaptation after sticky opt-out (UI toggle) — follow-up.
- Adaptation history / multiple revert rounds (only one snapshot-to-original).
- Adapting circuit/cardio templates.
- "Посмотреть оригинал" before/after diff view (optional, may add if cheap).

## Files touched (summary)

**Phase A:** `lib/ai/insight-facts.ts` (new), `lib/domain/**/select-insight-facts.ts` (new), `components/trainer/InsightCards.tsx`, `components/trainer/TrainerWaiting.tsx`, `components/trainer/StickmanLoader.tsx` (new), `app/api/ai/trainer/insights/route.ts` (remove call / delete if unused), `lib/ai/insight-card.ts` + `lib/ai/insight-query.ts` (delete if unused).

**Phase B:** `db/schema/templates.ts`, `db/migrations/0023_*.sql` (generated), `lib/repos/templates.repo.ts`, `lib/repos/training-programs.repo.ts`, `lib/domain/programs/adapt.ts` (reuse), `server/actions/workouts.ts`, `server/actions/templates*.ts` (revert action), `app/(app)/templates/page.tsx`, `app/(app)/templates/[id]/page.tsx`, plus a client revert button component.
