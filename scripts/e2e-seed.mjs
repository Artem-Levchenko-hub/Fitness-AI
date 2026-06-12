/** H7.3b — фикстура для мутирующего смоук-гейта (e2e/smoke.spec.ts).
 *
 *  Сидит на проде ДЕТЕРМИНИРОВАННУЮ фикстуру для тест-юзера
 *  claude-verify@local.test (тот же, что issue-session.mjs):
 *    1) завершённую силовую тренировку + подходы;
 *    2) сохранённый structured AI-разбор (ai_analyses.resultJson) этой
 *       тренировки — чтобы /workouts/<id>/trainer показывал TrainerResultCard
 *       детерминированно, без ожидания cron-воркера и без вызова LLM (гейт
 *       должен быть быстрым и стабильным, retries=0; реальный путь генерации
 *       разбора отдельно доказан end-to-end в exec26);
 *    3) друга (claude-friend@local.test) + принятую дружбу — чтобы
 *       /friends → профиль друга открывался.
 *
 *  Печатает REFRESH_TOKEN (сессия verify-юзера), USER_ID, WORKOUT_ID, FRIEND_ID.
 *  Эти id передаются Playwright как E2E_REFRESH_TOKEN / E2E_TRAINER_WORKOUT_ID /
 *  E2E_FRIEND_ID. Идемпотентно: повторный сид сносит прошлую фикстуру по маркеру
 *  имени и пере-вставляет — единственная свежая строка.
 *
 *  --cleanup удаляет ОБОИХ тест-юзеров (FK cascade сносит workout/sets/analysis/
 *  friendship), не оставляя данных на проде.
 *
 *  Запуск (на проде):
 *    node --env-file=.env.production scripts/e2e-seed.mjs
 *    node --env-file=.env.production scripts/e2e-seed.mjs --cleanup
 */
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { encode } from "next-auth/jwt";

const VERIFY_EMAIL = "claude-verify@local.test";
const FRIEND_EMAIL = "claude-friend@local.test";
const WORKOUT_MARKER = "E2E Smoke — Жим";

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

/** Апсерт юзера по email → возвращает id. */
async function upsertUser(email, name) {
  const rows = await sql`select id from users where email = ${email} limit 1`;
  if (rows[0]) return rows[0].id;
  const id = randomUUID();
  await sql`insert into users (id, email, name) values (${id}, ${email}, ${name})`;
  return id;
}

try {
  if (process.argv[2] === "--cleanup") {
    const r = await sql`
      delete from users where email in (${VERIFY_EMAIL}, ${FRIEND_EMAIL})`;
    console.log("deleted " + r.count + " test user(s)");
  } else {
    const verifyId = await upsertUser(VERIFY_EMAIL, "Claude Verify");
    const friendId = await upsertUser(FRIEND_EMAIL, "Claude Friend");

    // Принятая дружба verify → friend (idempotent).
    await sql`
      insert into friendships (id, requester_id, addressee_id, status)
      values (${randomUUID()}, ${verifyId}, ${friendId}, 'accepted')
      on conflict (requester_id, addressee_id)
      do update set status = 'accepted', updated_at = now()`;

    // Системное упражнение (owner_user_id IS NULL) для строки тренировки.
    const exRows = await sql`
      select id from exercises
      where owner_user_id is null
      order by (slug = 'barbell-bench-press') desc
      limit 1`;
    if (!exRows[0]) throw new Error("нет системных упражнений на проде");
    const exerciseId = exRows[0].id;

    // Идемпотентность: снести прошлую фикстуру по маркеру (cascade → sets+analysis).
    await sql`
      delete from workouts where user_id = ${verifyId} and name = ${WORKOUT_MARKER}`;

    const startedAt = new Date(Date.now() - 60 * 60 * 1000); // час назад
    const finishedAt = new Date(Date.now() - 30 * 60 * 1000); // полчаса назад

    const workoutId = randomUUID();
    await sql`
      insert into workouts (id, user_id, name, status, started_at, finished_at,
                            total_duration_seconds)
      values (${workoutId}, ${verifyId}, ${WORKOUT_MARKER}, 'completed',
              ${startedAt}, ${finishedAt}, 1800)`;

    const weId = randomUUID();
    await sql`
      insert into workout_exercises (id, workout_id, exercise_id, position)
      values (${weId}, ${workoutId}, ${exerciseId}, 0)`;

    const sets = [
      { idx: 0, type: "warmup", w: 60, reps: 8, rpe: null },
      { idx: 1, type: "working", w: 80, reps: 5, rpe: 8 },
      { idx: 2, type: "working", w: 82.5, reps: 5, rpe: 9 },
    ];
    for (const s of sets) {
      await sql`
        insert into workout_sets (id, workout_exercise_id, set_index, set_type,
                                  weight_kg, reps, rpe, completed_at)
        values (${randomUUID()}, ${weId}, ${s.idx}, ${s.type}, ${s.w}, ${s.reps},
                ${s.rpe}, ${finishedAt})`;
    }

    // Детерминированный structured-разбор (форма TrainerResponse, проходит
    // trainerSchema). content — короткий markdown, карточку рисует resultJson.
    const resultJson = {
      overallScore: 78,
      trainingQuality: { score: 80, comment: "Чистая работа в рабочих подходах." },
      recoveryContext: { score: null, comment: "Сон не записан за последние дни." },
      nutritionContext: { score: null, comment: "КБЖУ не записано." },
      exerciseComparisons: [
        {
          name: "Жим лёжа",
          prevTopSet: "80×5",
          curTopSet: "82.5×5",
          deltaReps: 0,
          deltaWeightKg: 2.5,
          status: "improved",
        },
      ],
      recommendations: ["Добавь 1 разминочный подход перед рабочими."],
      nextSessionFocus: "85×5 при RPE 8",
      missingDataAdvice: "Запиши сон и КБЖУ — разбор станет точнее.",
      motivation: "Прогресс есть — вес вырос с 80 до 82.5 кг.",
      whatWorked: "Вес рабочего подхода вырос на 2.5 кг при тех же 5 повторах.",
      followUpQuestion: "Как ощущались плечи на последнем подходе?",
    };

    await sql`
      insert into ai_analyses (id, user_id, workout_id, content, result_json,
                               model_version)
      values (${randomUUID()}, ${verifyId}, ${workoutId},
              '# Разбор тренировки (78/100)\n\nПрогресс есть — вес вырос с 80 до 82.5 кг.',
              ${sql.json(resultJson)}, 'seed-e2e')`;

    const refresh = await encode({
      token: { uid: verifyId },
      secret: process.env.AUTH_SECRET,
      salt: "fitness.refresh-token",
      maxAge: 60 * 60 * 24 * 365,
    });

    console.log("USER_ID=" + verifyId);
    console.log("FRIEND_ID=" + friendId);
    console.log("WORKOUT_ID=" + workoutId);
    console.log("REFRESH_TOKEN=" + refresh);
  }
} finally {
  await sql.end();
}
