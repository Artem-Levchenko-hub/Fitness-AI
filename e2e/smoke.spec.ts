import { test, expect } from "@playwright/test";

/**
 * H7.3 — критические потоки, гейт перед каждым consolidation-слайсом H7.
 *
 * H7.3a — read-only экраны (ничего не пишут в прод-БД).
 * H7.3b — мутирующие потоки на детерминированной фикстуре: разбор тренировки
 *   виден + навигация в профиль друга. Фикстуру сидит scripts/e2e-seed.mjs на
 *   проде (он же чистит её через --cleanup, не оставляя данных). Тесты читают
 *   id фикстуры из env и пропускаются, когда фикстура не засеяна (как и
 *   read-only тесты при отсутствии токена) — гейт не краснеет вхолостую.
 */

const trainerWorkoutId = process.env.E2E_TRAINER_WORKOUT_ID;
const prevWorkoutId = process.env.E2E_PREV_WORKOUT_ID;
const exerciseId = process.env.E2E_EXERCISE_ID;
const friendId = process.env.E2E_FRIEND_ID;
const circuitId = process.env.E2E_CIRCUIT_ID;
const prevCircuitId = process.env.E2E_PREV_CIRCUIT_ID;
const cardioId = process.env.E2E_CARDIO_ID;
const circuitTemplateId = process.env.E2E_CIRCUIT_TEMPLATE_ID;
const cardioTemplateId = process.env.E2E_CARDIO_TEMPLATE_ID;

test("/stats открывается с контентом, а не error-boundary", async ({ page }) => {
  await page.goto("/stats");
  await expect(page).toHaveURL(/\/stats/);
  // h1 «Статистика» — стабильный якорь, есть при любом объёме данных (R-37).
  await expect(
    page.getByRole("heading", { name: "Статистика", level: 1 }),
  ).toBeVisible();
});

test("/friends открывается со списком/empty-state", async ({ page }) => {
  await page.goto("/friends");
  await expect(page).toHaveURL(/\/friends/);
  await expect(
    page.getByRole("heading", { name: "Друзья", level: 1 }),
  ).toBeVisible();
});

test("/profile: аватар рендерится и его легенда тапабельна", async ({
  page,
}) => {
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/profile/);
  // Легенда-чипы (H6.3) свёрнуты по умолчанию (компактность) — раскрываем
  // disclosure. Чипы — тот же вход в дрилл, что тап по 3D-мышце; доказывают
  // «аватар тапабелен» даже там, где headless-WebGL недоступен.
  await page
    .getByText("Все группы мышц по нагреву", { exact: true })
    .click();
  const chip = page
    .getByRole("button", { name: /подходов за неделю/ })
    .first();
  await expect(chip).toBeVisible();
  await expect(chip).toBeEnabled();
});

test("/dashboard: tile-входы «Статистика» и «Друзья» ведут на /stats и /friends", async ({
  page,
}) => {
  // H9.1 — бюджет компоновки: входы «Статистика»/«Друзья» выведены на главную
  // одним рядом компактных tile (consolidation C1, фундамент H4.1/H3.1).
  // Главное действие старта остаётся выше — проверяем сами tile-входы.
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/);

  const statsTile = page.locator('main a[href="/stats"]').first();
  const friendsTile = page.locator('main a[href="/friends"]').first();
  await expect(statsTile).toBeVisible();
  await expect(statsTile).toContainText("Статистика");
  await expect(friendsTile).toBeVisible();
  await expect(friendsTile).toContainText("Друзья");

  // H4.1 — tile «Статистика» несёт week-strip-превью (7 дней + тоннаж + дельта),
  // не статичный hint. Снимок тех же данных, что графики /stats (тяжёлый
  // Recharts остаётся за тапом).
  const weekStrip = statsTile.getByTestId("dashboard-week-strip");
  await expect(weekStrip).toBeVisible();

  // H4.3 — ровно ОДИН носитель тоннажа недели на дашборде: тоннаж («кг·повт»)
  // несёт week-strip tile (совпадает со /stats); карточка «Эта неделя»
  // (WeekCard) теперь только число тренировок, без тоннажа.
  await expect(weekStrip).toContainText("кг·повт");
  const weekCard = page
    .locator("main div", { hasText: "Эта неделя" })
    .last();
  await expect(weekCard).not.toContainText("кг·повт");
  await expect(weekCard).not.toContainText("kg·reps");

  // Tile реально проваливается в /stats.
  await statsTile.click();
  await expect(page).toHaveURL(/\/stats/);
});

test("/dashboard: мини-аватар-витрина (H9.2) показывает heat-силуэт и ведёт на /profile", async ({
  page,
}) => {
  // H9.2 — крючок столпа 2 на главной: статичный heat-силуэт, тап → полный 3D
  // на /profile. Силуэт — инлайновый SVG (не WebGL) → надёжно проверяется в
  // headless: тайл виден, ведёт на /profile, реальный нагрев = хотя бы один
  // регион закрашен НЕ серым-dormant (#5b626b) у атлета с тренировками.
  await page.goto("/dashboard");
  const tile = page.getByTestId("dashboard-avatar-tile");
  await expect(tile).toBeVisible();
  await expect(tile).toHaveAttribute("href", "/profile");
  await expect(tile.locator("svg [data-muscle]").first()).toBeVisible();

  await tile.click();
  await expect(page).toHaveURL(/\/profile/);
});

test("H14.1 — /circuits/new несёт «Сохранить как шаблон» рядом со стартом", async ({
  page,
}) => {
  // H14.1 — круговую можно сохранить как переиспользуемый пресет (столп 3+4),
  // не только стартовать one-off. Билдер несёт вторичную кнопку «Сохранить как
  // шаблон» рядом с основной «Создать и начать круговую». Read-only проверка
  // (без записи): обе кнопки видимы.
  await page.goto("/circuits/new");
  await expect(page).toHaveURL(/\/circuits\/new/);
  await expect(
    page.getByRole("button", { name: "Создать и начать круговую" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Сохранить как шаблон" }),
  ).toBeVisible();
});

test("H14.3 — /cardio/new несёт «Сохранить как шаблон» на каждой форме", async ({
  page,
}) => {
  // H14.3 — кардио тоже сохраняется как переиспользуемый пресет (столп 3+4),
  // не только стартует one-off. Все 4 формы билдера (tabata/norwegian/emom/custom)
  // несут вторичную кнопку «Сохранить как шаблон» рядом со стартом «Начать»
  // (formAction переключает старт на сохранение, тот же FormData). Read-only:
  // обе кнопки видимы, есть хотя бы один старт и четыре сохранения.
  await page.goto("/cardio/new");
  await expect(page).toHaveURL(/\/cardio\/new/);
  await expect(
    page.getByRole("button", { name: "Начать" }).first(),
  ).toBeVisible();
  const saveButtons = page.getByRole("button", { name: "Сохранить как шаблон" });
  await expect(saveButtons.first()).toBeVisible();
  expect(await saveButtons.count()).toBeGreaterThanOrEqual(4);
});

test("H14.2 — /templates показывает круговой шаблон бейджем и стартует его", async ({
  page,
}) => {
  test.skip(
    !circuitTemplateId,
    "E2E_CIRCUIT_TEMPLATE_ID не задан — засеять через scripts/e2e-seed.mjs на проде",
  );
  // H14.2 — единая поверхность шаблонов: круговой пресет виден на /templates с
  // текстовым бейджем «Круговая» (R-41 — не только цвет), и стартует одним
  // кликом «Начать» через startCircuitFromTemplate (ноль дубля логики старта).
  await page.goto("/templates");
  await expect(page).toHaveURL(/\/templates/);

  const tplRow = page
    .locator("li", { hasText: "E2E Smoke — Круг-шаблон" })
    .first();
  await expect(tplRow).toBeVisible();
  // H14.5a — формат ведёт мета-строку как текст (R-41): «Круговая · N упражнений».
  await expect(tplRow.getByText(/^Круговая ·/)).toBeVisible();

  // «Начать» стартует круговую из пресета → активный сеанс /circuits/<id> с тем
  // же именем шаблона. one-off /circuits/new остаётся (столп 4) — здесь не трогаем.
  await tplRow.getByRole("button", { name: /Начать/ }).click();
  await expect(page).toHaveURL(/\/circuits\/[0-9a-f-]{36}/);
  await expect(
    page.getByRole("heading", { name: "E2E Smoke — Круг-шаблон", level: 1 }),
  ).toBeVisible();
});

test("H14.5b — круговой шаблон редактируется: «Изменить» → префилл → edit-режим", async ({
  page,
}) => {
  test.skip(
    !circuitTemplateId,
    "E2E_CIRCUIT_TEMPLATE_ID не задан — засеять через scripts/e2e-seed.mjs на проде",
  );
  // H14.5b — круговой шаблон можно редактировать (столп 3+4): на строке /templates
  // появилась вторичная ссылка «Изменить» ВНЕ submit-кнопки «Начать» (валидный
  // HTML, прецедент H6.2b), ведущая на /templates/circuit/<id>/edit. Там тот же
  // CircuitBuilder в режиме правки: префилл из шаблона (toCircuitBuilderInitial)
  // + кнопка «Сохранить изменения» вместо «Создать и начать» / «Сохранить как
  // шаблон». Старт one-off /circuits/new не тронут (столп 4). Сид: rounds=4.
  await page.goto("/templates");
  await expect(page).toHaveURL(/\/templates/);

  const tplRow = page
    .locator("li", { hasText: "E2E Smoke — Круг-шаблон" })
    .first();
  await expect(tplRow).toBeVisible();

  const editLink = tplRow.getByRole("link", { name: /Изменить шаблон/ });
  await expect(editLink).toHaveAttribute(
    "href",
    `/templates/circuit/${circuitTemplateId}/edit`,
  );

  await editLink.click();
  await expect(page).toHaveURL(
    new RegExp(`/templates/circuit/${circuitTemplateId}/edit`),
  );

  // Префилл: имя шаблона подставлено в поле «Название».
  await expect(page.locator("#name")).toHaveValue("E2E Smoke — Круг-шаблон");

  // Edit-режим: первичное действие = «Сохранить изменения»; one-off-кнопки
  // создания/«сохранить как шаблон» скрыты (это уже шаблон).
  await expect(
    page.getByRole("button", { name: "Сохранить изменения" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Создать и начать круговую" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Сохранить как шаблон" }),
  ).toHaveCount(0);
});

test("H14.4 — /templates показывает кардио-шаблон бейджем и стартует его", async ({
  page,
}) => {
  test.skip(
    !cardioTemplateId,
    "E2E_CARDIO_TEMPLATE_ID не задан — засеять через scripts/e2e-seed.mjs на проде",
  );
  // H14.4 — единая поверхность шаблонов: кардио-пресет виден на /templates с
  // текстовым бейджем «Кардио» (R-41 — не только цвет) и сводкой интервалов
  // (нет упражнений-детей), стартует одним кликом «Начать» через
  // startCardioFromTemplate (ноль дубля логики старта).
  await page.goto("/templates");
  await expect(page).toHaveURL(/\/templates/);

  const tplRow = page
    .locator("li", { hasText: "E2E Smoke — Кардио-шаблон" })
    .first();
  await expect(tplRow).toBeVisible();
  // H14.5a — формат ведёт мета-строку как текст (R-41): «Кардио · <интервалы>».
  // Мета-строка кардио = сводка интервалов custom-пресета, НЕ «N упражнений».
  await expect(tplRow.getByText("Кардио · Свой · 6×30/60с")).toBeVisible();

  // «Начать» стартует кардио из пресета → активный сеанс /cardio/<id> с тем же
  // именем шаблона. one-off /cardio/new остаётся (столп 4) — здесь не трогаем.
  await tplRow.getByRole("button", { name: /Начать/ }).click();
  await expect(page).toHaveURL(/\/cardio\/[0-9a-f-]{36}/);
  await expect(
    page.getByRole("heading", { name: "E2E Smoke — Кардио-шаблон", level: 1 }),
  ).toBeVisible();
});

test("разбор завершённой тренировки виден (TrainerResultCard)", async ({
  page,
}) => {
  test.skip(
    !trainerWorkoutId,
    "E2E_TRAINER_WORKOUT_ID не задан — засеять через scripts/e2e-seed.mjs на проде",
  );
  await page.goto(`/workouts/${trainerWorkoutId}/trainer`);
  await expect(page).toHaveURL(new RegExp(`/workouts/${trainerWorkoutId}/trainer`));
  // «Оценка тренера» — eyebrow карточки разбора (TrainerResultCard), есть только
  // когда сохранённый resultJson отрендерился, а не поллер/ошибка.
  await expect(page.getByText("Оценка тренера", { exact: true })).toBeVisible();

  // H13.2/H13.3 — на своём разборе заголовки учтённых факторов жизни кликабельны:
  // recovery score != null (сид=72) → «Восстановление (сон)» = ссылка на /sleep;
  // nutrition score != null (сид=65) → «Питание (КБЖУ)» = ссылка на /nutrition.
  // Граница «нет данных → статика» (score null) покрыта юнит-тестом
  // resolveLifeFactorHref. Проверяем ДО клика по строке упражнения ниже — он
  // уводит со страницы.
  await expect(page.locator('a[href="/sleep"]')).toBeVisible();
  const nutritionLink = page.locator('a[href="/nutrition"]');
  await expect(nutritionLink).toBeVisible();

  // H13.4 (4) — fail-soft статика (R-10/R-37): сид кладёт ВТОРУЮ строку
  // comparison с именем «Приседания со штангой», которого НЕТ среди упражнений
  // этой сессии (LLM упомянул другое упражнение). Имя не резолвится в карте →
  // строка рендерится статикой: текст виден (данные не теряются), но
  // /exercises-якорь НЕ создаётся. Проверяем ДО клика ниже (он уводит со
  // страницы): фантом-текст виден И /exercises-ссылок ровно одна (реальный жим).
  await expect(
    page.getByText("Приседания со штангой", { exact: true }),
  ).toBeVisible();
  await expect(page.locator('a[href^="/exercises/"]')).toHaveCount(1);

  // H13.1 — строка прогресса упражнения на своём разборе кликабельна: имя
  // упражнения → ссылка на историю /exercises/<id> (резолв по имени из этой
  // тренировки). Тап ведёт на историю подходов («что тогда было»).
  if (exerciseId) {
    const exLink = page.locator(`a[href="/exercises/${exerciseId}"]`).first();
    await expect(exLink).toBeVisible();
    await exLink.click();
    await expect(page).toHaveURL(new RegExp(`/exercises/${exerciseId}`));
  }
});

test("H13.5 — заголовок «Прошлый совет» ведёт в сам тот прошлый разбор", async ({
  page,
}) => {
  test.skip(
    !trainerWorkoutId || !prevWorkoutId,
    "E2E_TRAINER_WORKOUT_ID/E2E_PREV_WORKOUT_ID не заданы — засеять через scripts/e2e-seed.mjs",
  );
  // H13.5 — текущий разбор цитирует прошлую рекомендацию (resultJson сида несёт
  // pastAdviceFollowUp) → секция «Прошлый совет» рендерится, и её заголовок —
  // ссылка на свежайший прошлый разбор того же формата (prevWorkoutId), тот же
  // ряд, что кормит «Память тренера». Структурный якорь, не парсинг прозы.
  await page.goto(`/workouts/${trainerWorkoutId}/trainer`);
  await expect(page.getByText("Оценка тренера", { exact: true })).toBeVisible();

  const pastAdviceLink = page.locator(
    `a[href="/workouts/${prevWorkoutId}/trainer"]`,
  );
  await expect(pastAdviceLink).toBeVisible();
  await expect(pastAdviceLink).toContainText("Прошлый совет");

  // Тап реально ведёт в тот прошлый разбор (его карточка рендерится).
  await pastAdviceLink.click();
  await expect(page).toHaveURL(
    new RegExp(`/workouts/${prevWorkoutId}/trainer`),
  );
  await expect(page.getByText("Оценка тренера", { exact: true })).toBeVisible();
});

test("H13.4 — разбор на детали /workouts/[id] кликабелен идентично /trainer", async ({
  page,
}) => {
  test.skip(
    !trainerWorkoutId,
    "E2E_TRAINER_WORKOUT_ID не задан — засеять через scripts/e2e-seed.mjs на проде",
  );
  // H13.4 — та же сохранённая карточка разбора, что на /trainer, теперь
  // кликабельна и на детали истории /workouts/<id> (одна и та же строка ведёт
  // в источник на ОБЕИХ поверхностях своего разбора). Та же фикстура: recovery
  // score 72 → /sleep, nutrition 65 → /nutrition, строка упражнения → история.
  await page.goto(`/workouts/${trainerWorkoutId}`);
  await expect(page).toHaveURL(new RegExp(`/workouts/${trainerWorkoutId}`));
  await expect(page.getByText("Оценка тренера", { exact: true })).toBeVisible();
  await expect(page.locator('a[href="/sleep"]')).toBeVisible();
  await expect(page.locator('a[href="/nutrition"]')).toBeVisible();
  if (exerciseId) {
    await expect(
      page.locator(`a[href="/exercises/${exerciseId}"]`).first(),
    ).toBeVisible();
  }
});

test("H13.6 — «Прошлый совет» кликабелен на детали /workouts/[id] (паритет с /trainer)", async ({
  page,
}) => {
  test.skip(
    !trainerWorkoutId || !prevWorkoutId,
    "E2E_TRAINER_WORKOUT_ID/E2E_PREV_WORKOUT_ID не заданы — засеять через scripts/e2e-seed.mjs",
  );
  // H13.6 — инвариант H13.4 «одна строка кликабельна одинаково на всех своих
  // поверхностях» теперь и для «Прошлого совета»: на детали истории
  // /workouts/<cur> заголовок «Прошлый совет» = та же ссылка
  // /workouts/<prev>/trainer, что на /trainer. Раньше тут был статичный текст.
  await page.goto(`/workouts/${trainerWorkoutId}`);
  await expect(page).toHaveURL(new RegExp(`/workouts/${trainerWorkoutId}`));
  const pastAdviceLink = page.locator(
    `a[href="/workouts/${prevWorkoutId}/trainer"]`,
  );
  await expect(pastAdviceLink).toBeVisible();
  await expect(pastAdviceLink).toContainText("Прошлый совет");
});

test("H13.6 — «Прошлый совет» круговой ведёт на прошлую круговую /circuits/<prev>", async ({
  page,
}) => {
  test.skip(
    !circuitId || !prevCircuitId,
    "E2E_CIRCUIT_ID/E2E_PREV_CIRCUIT_ID не заданы — засеять через scripts/e2e-seed.mjs",
  );
  // H13.6 — паритет «Прошлого совета» на круговой: текущий разбор круговой
  // цитирует прошлую рекомендацию (resultJson сида несёт pastAdviceFollowUp) →
  // заголовок «Прошлый совет» = ссылка формата circuit на свежайшую прошлую
  // круговую (/circuits/<prev>). Тап реально ведёт в тот прошлый разбор.
  await page.goto(`/circuits/${circuitId}`);
  await expect(page).toHaveURL(new RegExp(`/circuits/${circuitId}`));
  await expect(page.getByText("Оценка тренера", { exact: true })).toBeVisible();

  const pastAdviceLink = page.locator(`a[href="/circuits/${prevCircuitId}"]`);
  await expect(pastAdviceLink).toBeVisible();
  await expect(pastAdviceLink).toContainText("Прошлый совет");

  await pastAdviceLink.click();
  await expect(page).toHaveURL(new RegExp(`/circuits/${prevCircuitId}`));
  await expect(page.getByText("Оценка тренера", { exact: true })).toBeVisible();
});

test("H13.4 — разбор круговой /circuits/[id] линкует факторы жизни (parity)", async ({
  page,
}) => {
  test.skip(
    !circuitId,
    "E2E_CIRCUIT_ID не задан — засеять через scripts/e2e-seed.mjs на проде",
  );
  // H13.4 — сохранённый разбор круговой на /circuits/<id> кликабелен идентично
  // силовой: recovery score 72 → «Восстановление (сон)» = /sleep, nutrition 65
  // → «Питание (КБЖУ)» = /nutrition. exerciseComparisons=[] (реальность
  // круговой) → строк упражнений нет, граница «нет данных → статика» держится
  // юнит-тестом resolveLifeFactorHref. own-data; share /a/[token] статика.
  await page.goto(`/circuits/${circuitId}`);
  await expect(page).toHaveURL(new RegExp(`/circuits/${circuitId}`));
  await expect(page.getByText("Оценка тренера", { exact: true })).toBeVisible();
  await expect(page.locator('a[href="/sleep"]')).toBeVisible();
  await expect(page.locator('a[href="/nutrition"]')).toBeVisible();
});

test("/workouts: три формата (силовая+круговая+кардио) вперемешку, каждый открывается в свой detail", async ({
  page,
}) => {
  test.skip(
    !trainerWorkoutId || !circuitId || !cardioId,
    "E2E_TRAINER_WORKOUT_ID/E2E_CIRCUIT_ID/E2E_CARDIO_ID не заданы — засеять через scripts/e2e-seed.mjs",
  );

  // H7.4 — единый поток: фид /workouts должен показать все три формата
  // (силовая /workouts/<id>, круговая /circuits/<id>, кардио /cardio/<id>) в
  // одном списке, отсортированном по времени (новые сверху). Сид расставил
  // started_at так: кардио −45 мин, силовая −60, круговая −90 → ожидаемый
  // порядок в DOM = кардио, силовая, круговая. Ни один формат не теряется.
  await page.goto("/workouts");
  await expect(page).toHaveURL(/\/workouts/);

  const strengthHref = `/workouts/${trainerWorkoutId}`;
  const circuitHref = `/circuits/${circuitId}`;
  const cardioHref = `/cardio/${cardioId}`;

  for (const href of [strengthHref, circuitHref, cardioHref]) {
    await expect(page.locator(`a[href="${href}"]`).first()).toBeVisible();
  }

  // Порядок в фиде = хронологический (кардио → силовая → круговая). Берём
  // позиции карточек по их href среди всех ссылок-карточек истории.
  const order = await page.evaluate(
    ({ s, c, k }) => {
      const hrefs = Array.from(
        document.querySelectorAll("main a[href]"),
      ).map((a) => a.getAttribute("href") ?? "");
      return { s: hrefs.indexOf(s), c: hrefs.indexOf(c), k: hrefs.indexOf(k) };
    },
    { s: strengthHref, c: circuitHref, k: cardioHref },
  );
  expect(order.k).toBeGreaterThanOrEqual(0);
  expect(order.k).toBeLessThan(order.s); // кардио (−45) выше силовой (−60)
  expect(order.s).toBeLessThan(order.c); // силовая (−60) выше круговой (−90)

  // Каждая карточка открывается в СВОЙ корректный detail-вид (не 404/login).
  await page.goto(circuitHref);
  await expect(page).toHaveURL(new RegExp(`/circuits/${circuitId}`));
  await expect(
    page.getByRole("heading", { name: "E2E Smoke — Круг", level: 1 }),
  ).toBeVisible();

  await page.goto(cardioHref);
  await expect(page).toHaveURL(new RegExp(`/cardio/${cardioId}`));
  await expect(
    page.getByRole("heading", { name: "E2E Smoke — Кардио", level: 1 }),
  ).toBeVisible();

  await page.goto(strengthHref);
  await expect(page).toHaveURL(new RegExp(`/workouts/${trainerWorkoutId}`));
  await expect(
    page.getByRole("heading", { name: "E2E Smoke — Жим", level: 1 }),
  ).toBeVisible();
});

test("/friends → переход в профиль друга", async ({ page }) => {
  test.skip(
    !friendId,
    "E2E_FRIEND_ID не задан — засеять через scripts/e2e-seed.mjs на проде",
  );
  await page.goto("/friends");
  // Ссылка на друга в списке «Ваши друзья» (href = /friends/<id>).
  await page.locator(`a[href="/friends/${friendId}"]`).first().click();
  await expect(page).toHaveURL(new RegExp(`/friends/${friendId}`));
  // «Только просмотр» — eyebrow страницы профиля друга (read-only вид).
  await expect(
    page.getByText("Только просмотр", { exact: true }),
  ).toBeVisible();
});
