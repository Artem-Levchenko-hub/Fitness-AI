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
const strengthTemplateId = process.env.E2E_STRENGTH_TEMPLATE_ID;
const waitingCircuitId = process.env.E2E_WAITING_CIRCUIT_ID;
const waitingWorkoutId = process.env.E2E_WAITING_WORKOUT_ID;
const activeWorkoutId = process.env.E2E_ACTIVE_WORKOUT_ID;

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

test("H12.3 нав-гигиена: /settings — заголовок «Настройки», /friends ведёт назад на «Главная»", async ({
  page,
}) => {
  // (а) Страница настроек больше не озаглавлена «Профиль» (это отдельный
  // экран /profile) — h1 = «Настройки», совпадает с eyebrow.
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/settings/);
  await expect(
    page.getByRole("heading", { name: "Настройки", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Профиль", level: 1 }),
  ).toHaveCount(0);

  // (б) Back-link /friends ведёт на главную, не в настройки (артефакт эпохи
  // «друзья погребены за 3 тапа в /settings»). Скоупим в <main>: BottomTabBar
  // (nav «Главная навигация») несёт ПОСТОЯННУЮ вкладку «Главная» → /dashboard на
  // каждом (app)-экране, поэтому глобальный getByRole('link', {name:'Главная'})
  // даёт strict-mode-конфликт двух якорей; нам нужен именно in-page back-link.
  await page.goto("/friends");
  const back = page
    .getByRole("main")
    .getByRole("link", { name: "Главная" });
  await expect(back).toHaveAttribute("href", "/dashboard");
  await back.click();
  await expect(page).toHaveURL(/\/dashboard/);

  // /profile остаётся отдельным экраном с заголовком «Профиль».
  await page.goto("/profile");
  await expect(
    page.getByRole("heading", { name: "Настройки", level: 1 }),
  ).toHaveCount(0);
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

test("H12.0 — WeekCard «Эта неделя» считает ВСЕ форматы и совпадает с /workouts", async ({
  page,
}) => {
  test.skip(
    !trainerWorkoutId || !circuitId || !cardioId,
    "E2E_TRAINER_WORKOUT_ID/E2E_CIRCUIT_ID/E2E_CARDIO_ID не заданы — засеять через scripts/e2e-seed.mjs",
  );
  // H12.0 — честный счёт WeekCard: раньше считались только силовые в серверной
  // TZ → круговая/кардио выпадали. Теперь счёт = завершённые сессии ВСЕХ
  // форматов за текущую ISO-неделю в TZ юзера, тем же ключом, что группирует
  // «Эта неделя» на /workouts. Гейт: число WeekCard == число карточек группы
  // «Эта неделя» на /workouts (self-consistent: оба из одного сида, где этой
  // недели есть силовая + круговая + кардио → ≥3, не только силовые).
  await page.goto("/workouts");
  const thisWeek = page.locator("section", {
    has: page.getByRole("heading", { name: "Эта неделя" }),
  });
  await expect(thisWeek).toBeVisible();
  const cardCount = await thisWeek.locator("ul > li").count();
  expect(cardCount).toBeGreaterThanOrEqual(3); // все три формата этой недели

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByTestId("dashboard-week-count")).toHaveText(
    String(cardCount),
  );
});

test("H12.1 — активная тренировка: «Прошлый раз» + префилл веса прошлой сессии", async ({
  page,
}) => {
  test.skip(
    !activeWorkoutId,
    "E2E_ACTIVE_WORKOUT_ID не задан — засеять через scripts/e2e-seed.mjs",
  );
  await page.goto(`/workouts/${activeWorkoutId}`);
  await expect(page).toHaveURL(new RegExp(`/workouts/${activeWorkoutId}`));
  // Активная (не completed) → рендерит SetInput, не CompletedView.
  await expect(
    page.getByText("Активная тренировка", { exact: true }),
  ).toBeVisible();
  // «Прошлый раз» = working-подходы ПОСЛЕДНЕЙ по started_at завершённой сессии
  // жима. В сиде это WAITING_MARKER (начат 20 мин назад, working 80×5) — он
  // свежее WORKOUT_MARKER (60 мин назад) → фича показывает реально последнюю
  // сессию (совпадение с верхней карточкой /exercises/[id] проверяется в
  // live-MCP-верификации слайса).
  const prevLine = page.locator("p", { hasText: "Прошлый раз:" });
  await expect(prevLine).toBeVisible();
  await expect(prevLine).toContainText("80×5");
  // Префилл первого подхода = вес последнего рабочего подхода прошлой сессии.
  await expect(page.getByLabel("Вес, кг")).toHaveValue("80");
});

test("H12.4 — активная силовая несёт «Прервать» из самой сессии (анти-регресс перед глобальной полосой)", async ({
  page,
}) => {
  test.skip(
    !activeWorkoutId,
    "E2E_ACTIVE_WORKOUT_ID не задан — засеять через scripts/e2e-seed.mjs",
  );
  // H12.4 под-слайс 1: отменить зависшую силовую теперь можно из её страницы
  // (зеркало круговой/кардио) — это сохранность «Убрать» ПЕРЕД тем, как
  // следующий слайс уберёт page-level resume-баннер. Ассерт неразрушающий
  // (видимость кнопки) — реальная отмена проверяется live-MCP, чтобы не гасить
  // seed-сессию, нужную другим тестам.
  await page.goto(`/workouts/${activeWorkoutId}`);
  await expect(
    page.getByText("Активная тренировка", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Прервать" }),
  ).toBeVisible();
});

test("H12.2 — /create «Силовая»: список шаблонов раскрыт, тап ведёт на старт (повтор ≤2 тапа)", async ({
  page,
}) => {
  test.skip(
    !strengthTemplateId,
    "E2E_STRENGTH_TEMPLATE_ID не задан — засеять через scripts/e2e-seed.mjs",
  );
  await page.goto("/create");
  await expect(page).toHaveURL(/\/create/);
  // ≥1 силовой шаблон → карточка «Силовая» РАСКРЫТА списком (а не прямой ссылкой
  // в билдер): строка шаблона ведёт на экран старта /templates/<id>, где живут
  // совет и кнопка старта.
  const repeatLink = page.getByRole("link", { name: /Силовой-шаблон/ });
  await expect(repeatLink).toBeVisible();
  await expect(repeatLink).toHaveAttribute(
    "href",
    `/templates/${strengthTemplateId}`,
  );
  // Строка «Создать новый шаблон» сохраняет старый путь в конструктор (столп 4).
  await expect(
    page.getByRole("link", { name: "Создать новый шаблон" }),
  ).toHaveAttribute("href", "/templates/new");
  // Тап по шаблону → экран старта: повтор существующего шаблона за ≤2 тапа от
  // дашборда (дашборд → /create → этот тап).
  await repeatLink.click();
  await expect(page).toHaveURL(new RegExp(`/templates/${strengthTemplateId}`));
});

test("H12.2 item-c — /dashboard: один канонический вход повтора (/create), второй = управление (/templates)", async ({
  page,
}) => {
  // Консолидация дубль-входов (столп 3): запуск повтора живёт ровно в одном
  // месте — «Начать тренировку» → /create-пикер (раскрывает шаблоны 3 форматов).
  // Вторая кнопка StartCard relabel в УПРАВЛЕНИЕ (CRUD) → /templates, чтобы не
  // плодить второй launch-аффорданс. Без сида — StartCard рендерится всегда.
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/);

  // Канонический вход повтора сохранён (столп 4 анти-регресс).
  const startLink = page.getByRole("link", { name: "Начать тренировку" });
  await expect(startLink).toBeVisible();
  await expect(startLink).toHaveAttribute("href", "/create");

  // Второй вход = управление: новый label + ведёт на /templates.
  const manageLink = page.getByTestId("dashboard-manage-templates");
  await expect(manageLink).toBeVisible();
  await expect(manageLink).toHaveText(/Управление шаблонами/);
  await expect(manageLink).toHaveAttribute("href", "/templates");

  // Прежний launch-аффорданс «Мои шаблоны» на дашборде больше не существует
  // (иначе второй путь запуска тихо вернулся бы).
  await expect(page.getByRole("link", { name: "Мои шаблоны" })).toHaveCount(0);
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

test("H11.2 — голос тренера на /dashboard ведёт в последний разбор; dismiss переживает reload", async ({
  page,
}) => {
  test.skip(
    !circuitId,
    "E2E_CIRCUIT_ID не задан — засеять через scripts/e2e-seed.mjs на проде",
  );
  // H11.2 — тренер, уже разобравший сессию, говорит первым на главной (столп 1):
  // одна строка-совет (nextSessionFocus последнего разбора) отдельной dismissible-
  // секцией над StartCard. Сид: свежайший per-workout разбор = текущая круговая
  // (вставлена последней из ai_analyses) с focus «4 раунда вместо 3» → ссылка
  // ведёт на /circuits/<circuitId>. Анти-фантом (R-37): скрытая строка = НИЧЕГО
  // в DOM (count=0), а не пустая строка; «новый разбор не скрыт» покрыт юнитом
  // shouldShowFocusHint; «нет разбора → count=0» покрыт юнитом buildTrainerVoice.
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/);

  const voice = page.getByTestId("dashboard-trainer-voice");
  await expect(voice).toHaveCount(1); // ровно одна строка, не фантом-дубль
  const voiceLink = voice.getByRole("link");
  await expect(voiceLink).toHaveAttribute("href", `/circuits/${circuitId}`);
  await expect(voiceLink).toContainText("4 раунда вместо 3"); // реальный focus

  // Тап реально ведёт в тот разбор (его карточка рендерится).
  await voiceLink.click();
  await expect(page).toHaveURL(new RegExp(`/circuits/${circuitId}`));
  await expect(page.getByText("Оценка тренера", { exact: true })).toBeVisible();

  // Dismiss: закрываю строку → её больше нет в DOM (count=0), и закрытие
  // переживает reload (persist по analysisId в localStorage).
  await page.goto("/dashboard");
  await expect(voice).toHaveCount(1);
  await voice.getByRole("button", { name: "Скрыть совет тренера" }).click();
  await expect(voice).toHaveCount(0);
  await page.reload();
  await expect(voice).toHaveCount(0);
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

test("H14.5c — кардио-шаблон редактируется: «Изменить» → префилл → edit-режим", async ({
  page,
}) => {
  test.skip(
    !cardioTemplateId,
    "E2E_CARDIO_TEMPLATE_ID не задан — засеять через scripts/e2e-seed.mjs на проде",
  );
  // H14.5c — кардио-шаблон можно редактировать (столп 3+4): на строке /templates
  // появилась вторичная ссылка «Изменить» ВНЕ submit-кнопки «Начать» (валидный
  // HTML, прецедент H6.2b), ведущая на /templates/cardio/<id>/edit. Кардио-
  // «билдера» нет — там форма правки: префилл из плана (toCardioEditInitial) +
  // кнопка «Сохранить изменения». one-off /cardio/new не тронут (столп 4). Сид:
  // custom-пресет, rounds=6.
  await page.goto("/templates");
  await expect(page).toHaveURL(/\/templates/);

  const tplRow = page
    .locator("li", { hasText: "E2E Smoke — Кардио-шаблон" })
    .first();
  await expect(tplRow).toBeVisible();

  const editLink = tplRow.getByRole("link", { name: /Изменить шаблон/ });
  await expect(editLink).toHaveAttribute(
    "href",
    `/templates/cardio/${cardioTemplateId}/edit`,
  );

  await editLink.click();
  await expect(page).toHaveURL(
    new RegExp(`/templates/cardio/${cardioTemplateId}/edit`),
  );

  // Префилл: имя шаблона в поле «Название», параметр custom-пресета (Раундов=6).
  await expect(page.locator("#name")).toHaveValue("E2E Smoke — Кардио-шаблон");
  await expect(page.locator('input[name="rounds"]')).toHaveValue("6");

  // Edit-режим: первичное действие = «Сохранить изменения»; one-off-кнопки
  // старта/«сохранить как шаблон» с /cardio/new здесь отсутствуют.
  await expect(
    page.getByRole("button", { name: "Сохранить изменения" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Сохранить как шаблон" }),
  ).toHaveCount(0);
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

test("H17.0-B — силуэт под «Баланс по аватару» кликабелен: тап группы → /profile?muscle=<key>", async ({
  page,
}) => {
  test.skip(
    !trainerWorkoutId,
    "E2E_TRAINER_WORKOUT_ID не задан — засеять через scripts/e2e-seed.mjs на проде",
  );
  await page.goto(`/workouts/${trainerWorkoutId}/trainer`);
  await expect(page).toHaveURL(new RegExp(`/workouts/${trainerWorkoutId}/trainer`));

  // Сид кладёт muscleBalanceNote + balanceMuscleKeys=["chest","quads"] →
  // секция «Баланс по аватару» несёт кликабельный мини-силуэт (BalanceSilhouette).
  await expect(page.getByText("Баланс по аватару", { exact: true })).toBeVisible();
  const silhouette = page.locator('svg[aria-label*="Баланс групп"]');
  await expect(silhouette).toBeVisible();

  // Тап по фигуре «грудь» (named тренером) → /profile?muscle=chest. Deep-link
  // (sub-slice A) открывает панель мышцы «Грудь» на маунте.
  await silhouette.locator('[data-muscle="chest"]').first().click();
  await expect(page).toHaveURL(/\/profile\?muscle=chest/);
  await expect(page.getByRole("heading", { name: "Грудь" })).toBeVisible();
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

test("H16.3 — круговая в ожидании разбора: живой лоадер, а не «обнови страницу»", async ({
  page,
}) => {
  test.skip(
    !waitingCircuitId,
    "E2E_WAITING_CIRCUIT_ID не задан — засеять через scripts/e2e-seed.mjs на проде",
  );
  // H16.3 де-фриз: круговая с pending circuit ai_job (far-future → 0 LLM) на
  // /circuits/<id> рендерит TrainerJobPoller — живые стадии вместо статичного
  // спиннера. Детерминированные ассерты (без живого embeddings-вызова —
  // карточки фактов проверяются разово через MCP, не в смоуке): первая стадия
  // ленты видна И мёртвый текст «обнови страницу» исчез.
  await page.goto(`/circuits/${waitingCircuitId}`);
  await expect(page).toHaveURL(new RegExp(`/circuits/${waitingCircuitId}`));
  await expect(page.getByText("Читаю твои подходы")).toBeVisible();
  await expect(page.getByText("обнови страницу")).toHaveCount(0);
});

test("H16.4 — силовая в ожидании разбора: живой лоадер (толерантно к карточкам)", async ({
  page,
}) => {
  test.skip(
    !waitingWorkoutId,
    "E2E_WAITING_WORKOUT_ID не задан — засеять через scripts/e2e-seed.mjs на проде",
  );
  // H16.4 толерантная смоук-форма: силовая с pending ai_job (far-future → 0 LLM)
  // на /workouts/<id>/trainer рендерит TrainerJobPoller → живой лоадер ожидания
  // (стадии Ahead + скелет). Утверждаем ИМЕННО живой лоадер (детерминирован), а
  // НЕ карточку-факт: RAG-ретрив = живой embeddings-вызов, его в постоянный сьют
  // не кладём (флейк-вектор) — карточки проверяются разово MCP. Так гейт зелён
  // и когда RAG отдал куски, и когда промолчал — оба = PASS (fail-soft R-10/R-37).
  await page.goto(`/workouts/${waitingWorkoutId}/trainer`);
  await expect(page).toHaveURL(new RegExp(`/workouts/${waitingWorkoutId}/trainer`));
  await expect(page.getByText("Читаю твои подходы")).toBeVisible();
  // Скелет разбора живёт под стадиями (role=status) — лоадер не «завис».
  await expect(page.getByRole("status")).toBeVisible();
});

test("H16.4 — reduced-motion: лоадер остаётся спокойным, без дёрганья и ложного «готово»", async ({
  page,
}) => {
  test.skip(
    !waitingWorkoutId,
    "E2E_WAITING_WORKOUT_ID не задан — засеять через scripts/e2e-seed.mjs на проде",
  );
  // H16.4 (закрывает отложенный из H16.3 reduced-motion-ассерт): при
  // prefers-reduced-motion лента стадий не тикает (TrainerStages выходит из
  // эффекта рано — elapsed=0 → активна только первая стадия), спиннер не
  // крутится. Утверждаем спокойный фолбэк: лоадер ВСЁ РАВНО отрендерен (первая
  // стадия видна) И последняя стадия на месте, т.е. нет ложного схлопывания в
  // «всё готово» (массив стадий никогда не all-done — waiting-stages.ts).
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/workouts/${waitingWorkoutId}/trainer`);
  await expect(page.getByText("Читаю твои подходы")).toBeVisible();
  await expect(page.getByText("Пишу разбор")).toBeVisible();
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

test("H3.2 — лента /friends показывает последнее событие друга (формат + тоннаж)", async ({
  page,
}) => {
  test.skip(
    !friendId,
    "E2E_FRIEND_ID не задан — засеять через scripts/e2e-seed.mjs на проде",
  );
  await page.goto("/friends");
  // Карточка друга в списке = ссылка на его профиль; внутри — бейдж формата
  // последнего события и метрика. Друг засеян завершённой силовой 100×5+80×5.
  const card = page.locator(`a[href="/friends/${friendId}"]`).first();
  await expect(card).toBeVisible();
  await expect(card).toContainText("Силовая");
  // Тоннаж рабочих подходов 100×5 + 80×5 = 900 kg·reps — совпадает со страницей
  // друга (гейт H3.2 «тоннаж совпадает со страницей друга»).
  await expect(card).toContainText("900 kg·reps");
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

test("H3.3 — шапка профиля друга показывает рост · вес (read-only, за areFriends-гейтом)", async ({
  page,
}) => {
  test.skip(
    !friendId,
    "E2E_FRIEND_ID не задан — засеять через scripts/e2e-seed.mjs на проде",
  );
  await page.goto(`/friends/${friendId}`);
  // Друг засеян ростом 178 см (users.height_cm) + замером веса 82.5 кг
  // (body_measurements). Строка совпадает с его /body и видна только другу.
  await expect(page.getByText("178 см · 82.5 кг", { exact: true })).toBeVisible();
});

test("H15.5 — airplane-mode: офлайн-подход переживает reload и синкается при реконнекте (ноль потерь/дублей)", async ({
  page,
}) => {
  test.skip(
    !activeWorkoutId,
    "E2E_ACTIVE_WORKOUT_ID не задан — засеять через scripts/e2e-seed.mjs",
  );
  // H15.5 — капстоун offline-first: единственный автоматический гейт ПОЛНОГО
  // airplane-цикла «начать → сохранить → синк» (владелец дословно: «начать,
  // сохранить — и они ТОЧНО сохранятся, друзья увидят их когда появится
  // интернет»). Замыкает в один регресс то, что прежде проверялось вручную через
  // MCP: офлайн-запись (H15.3b), переживание reload, реконнект-дренаж (H15.4) и
  // индикатор «N несинхронизировано»→0 (sharpen line-243). Детерминирован — ноль
  // LLM. Мутирует seed-активную тренировку (drain пишет 1 подход) → снос
  // scripts/e2e-seed.mjs --cleanup. Идёт ПОСЛЕДНИМ (workers:1) — оставляет
  // активную тренировку нетронутой для H12.1/H12.4 выше.
  const ctx = page.context();

  // 1) Онлайн-визит прогревает SW-кэш страницы (reload офлайн затем отдаётся из
  //    него — network-first sw.js). Свежий seed = 0 подходов.
  await page.goto(`/workouts/${activeWorkoutId}`);
  await expect(
    page.getByText("Активная тренировка", { exact: true }),
  ).toBeVisible();

  // 2) Офлайн → подход идёт в IndexedDB-outbox, не на сервер (navigator.onLine=
  //    false → SetInput.recordOffline). Оптимистичная строка видна сразу и
  //    помечена «не синхр.» (R-41 — иконка CloudOff + текст, не только цвет).
  await ctx.setOffline(true);
  await page.getByLabel("Вес, кг").fill("70");
  await page.getByLabel("Повторений").fill("6");
  await page.getByRole("button", { name: /Завершить подход/ }).click();

  // Оптимистичная строка = внутренний dashed-li подхода (не внешняя карточка
  // упражнения — она тоже содержит «не синхр.»; `li.border-dashed` бьёт ровно
  // в pending-строку, у серверных рядов и карточки этого класса нет).
  const offlineRow = page.locator("li.border-dashed", { hasText: "не синхр." });
  await expect(offlineRow).toContainText("70 кг × 6");
  // Бейдж сетевого статуса виден — единственный носитель сигнала (OfflineBanner).
  await expect(page.locator("[data-offline-banner]")).toBeVisible();

  // 3) Reload ОФЛАЙН (страница из SW-кэша) → офлайн-подход переживает: на маунте
  //    ActiveWorkoutView восстанавливает его из outbox (listPending). Активная
  //    тренировка = серверный RSC-рендер без подхода → доказывает, что строка
  //    живёт именно в IndexedDB, а не в серверном снимке.
  await page.reload();
  await expect(
    page.locator("li.border-dashed", { hasText: "не синхр." }),
  ).toContainText("70 кг × 6");

  // 4) Реконнект → online-событие → OfflineBanner дренажит outbox через ТОТ ЖЕ
  //    recordSetAction под тем же client_set_id (идемпотентно). Индикатор «N
  //    несинхронизировано» опускается до 0 → бейдж исчезает из DOM. Auto-retry
  //    assertion (expect.timeout=10s) поглощает латентность дренажа.
  await ctx.setOffline(false);
  await expect(page.locator("[data-offline-banner]")).toHaveCount(0);

  // 5) Reload ОНЛАЙН → подход теперь СЕРВЕРНАЯ строка (несёт «Удалить подход»),
  //    оптимистичная «не синхр.» исчезла, и таких строк РОВНО одна (ноль дублей —
  //    partial-unique client_set_id отбил бы повторный дренаж).
  await page.reload();
  // Серверная строка подхода = внутренний li с классом `bg-background` (карточка
  // упражнения — `bg-card`, офлайн-ряды — `bg-muted/40`; так бьём ровно в
  // синхронизированный подход, а не в его li-предка). Свежий seed = 0 подходов →
  // дренаж даёт РОВНО один → count 1 (ноль дублей; partial-unique client_set_id
  // отбил бы повторный дренаж). Несёт «Удалить подход» (у офлайн-рядов её нет).
  const serverRow = page.locator("li.bg-background", { hasText: "70 кг × 6" });
  await expect(serverRow).toHaveCount(1);
  await expect(
    serverRow.getByRole("button", { name: "Удалить подход" }),
  ).toBeVisible();
  await expect(page.getByText("не синхр.")).toHaveCount(0);
});
