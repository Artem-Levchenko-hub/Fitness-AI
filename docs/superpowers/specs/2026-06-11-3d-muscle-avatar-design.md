# 3D-аватар «горящих мышц» на /profile — дизайн

**Дата:** 2026-06-11 · **Ветка:** `feature/3d-muscle-avatar` · **Статус:** одобрено владельцем

## Цель

Профиль атлета с 3D-телом, которое светится по объёму тренировок: серый (не
тренировал) → красный (норма и выше) по каждой из 14 групп мышц. Тап по мышце
открывает инфо-панель с прогрессивным циклом данных. Модель крутится мышью и
пальцем (мобайл). Друзья видят аватар атлета через `/friends/[friendId]`.

## Продуктовые решения (подтверждены владельцем)

- **Окно нагрева:** объём за последние **7 дней vs собственная норма** (среднее
  недельное за прошлые недели). Шкала честная для каждой мышцы отдельно (ноги
  объёмнее рук — сравниваем мышцу с её же прошлым, не мышцы между собой).
- **Тап:** первый тап → **тоннаж**; повторные тапы по той же мышце листают цикл
  `тоннаж → подходы → последняя тренировка → топ-3 упражнения`; тап по другой
  мышце сбрасывает на тоннаж. Минимализм + максимум информации.
- **Размещение:** новый роут `/profile`. Таб «Профиль» в нижней навигации ведёт
  на него. Рост/вес — под аватаром. Шестерёнка → `/settings`. Друг видит тот же
  экран read-only.
- **Модель:** лёгкая готовая (Z-Anatomy Myology, Sketchfab, CC BY-SA 4.0).
  Атрибуция + BY-SA на сам glb-файл (код SaaS не заражается — ассет и код
  разделены).

## Ключевой архитектурный приём — «шов модели»

Рендер-компонент принимает `(modelUrl, meshName→muscleKey mapping, heatByMuscle)`
как входы. Модель = подменяемые данные, не код. Фича строится и тестируется на
**лёгкой временной модели** (placeholder, 14 именованных мешей); финальный glb
вставляется подменой одной строки URL + маппинга. Фича не заблокирована на
ассете, который требует офлайн-обработки в Blender.

## Слои (зависимости вниз — R-7)

### 1. Данные (чистый домен + repo) — без 3D, полностью юнит-тестируемо

- `lib/domain/avatar/heat.ts` — чистые функции:
  - `MUSCLE_KEYS` — канонический упорядоченный список 14 ключей (домен, не
    импорт `db`).
  - `heatLevel(current7d, baselineWeekly)` → `{ ratio, level, t }`, где `level ∈
    {dormant, low, normal, high, peak}` и `t ∈ [0,1]` — позиция на рампе.
  - `heatColorStop(t)` → hex/oklch строка из доменной рампы (серый→красный),
    single source of truth (зеркалится в CSS-комментарии — R-36 нюанс ниже).
  - `heatLabel(level)` → человекочитаемый ярлык RU.
  - Edge cases: `baselineWeekly === 0` и `current7d > 0` (новая мышца / первые
    недели) → не делим, мапим по абсолютному порогу в «тёплый»;
    `current7d === 0` → `dormant` (серый); недостаточно истории → нейтральный
    уровень (UI показывает empty-hint, не вводящие в заблуждение цвета).
- `lib/repos/stats.repo.ts` — новая `muscleHeatProfile(userId, now, tz)` →
  `Record<muscleKey, { current7d, baselineWeekly, sets, lastTrainedAt,
  top3 }>`. Окна: текущее `[now-7d, now)`, baseline `[now-(N+1)*7d, now-7d)`
  усреднённое на число недель (N=4 по умолчанию). Шаблон — приватная
  `workingTonnage(from,to)`.
- **Консолидация дублей (R-04):** сейчас per-muscle join реализован дважды —
  `stats.repo.volumeByMuscle` и `lib/ai/context-builder.loadVolumeByMuscle`,
  причём AI-версия с латентным багом (не фильтрует `status='completed'`, считает
  active/cancelled). Извлекаю один канонический строитель строк per-muscle (или
  переиспользую `distributeVolumeByMuscle` из `lib/domain/progression/volume.ts`
  — готовую, но неиспользуемую). Не плодим третью копию; чиню AI-баг попутно.

### 2. 3D-рендер (client-only)

- `components/avatar/AvatarCanvas.tsx` — `<Canvas frameloop="demand">` (рендер
  только при вращении/смене данных — телефон не греется), `OrbitControls`
  (вращение + pinch-zoom, без pan), `Suspense`, свет, `invalidate` на change
  контролов. `prefers-reduced-motion` → без авто-вращения.
- `components/avatar/MuscleModel.tsx` — `useGLTF`, обход мешей, резолв
  `muscleKey` через маппинг-конфиг, цвет/emissive каждой группы из heat-карты,
  `onClick` raycast → `onSelectMuscle(key)`. Выделение выбранной мышцы =
  emissive bump.
- `components/avatar/MuscleInfoPanel.tsx` — оверлей обычным React (легче и
  доступнее drei `<Html>`). Прогрессивный цикл полей. Все поля уже в payload —
  без запроса на каждый тап.
- `components/avatar/ProfileAvatar.tsx` (client) — обёртка через
  `next/dynamic(() => import('./AvatarCanvas'), { ssr:false, loading })`. Первый
  `next/dynamic` в репозитории — задаёт паттерн ленивого 3D. **Next 16: `ssr:false`
  нельзя в Server Component — обёртка должна быть `'use client'`. Сверить с
  `node_modules/next/dist/docs` перед кодом (AGENTS.md).**
- `lib/avatar/muscle-mesh-map.ts` — `meshName → muscleKey` конфиг. Для
  placeholder меши именуются ровно ключами (identity map); для реальной модели —
  таблица соответствия имён Z-Anatomy.

### 3. Маршрут + соц

- `app/(app)/profile/page.tsx` (Server Component) — `requireUser` →
  `muscleHeatProfile` + `getUserProfile` + `getLatestMeasurement` →
  `ProfileAvatar`. Рост (profile.heightCm) + вес (последний `body_measurement`)
  под аватаром. Шестерёнка → `/settings`. `loading.tsx` / `error.tsx`; empty =
  «мало истории, потренируйся».
- `components/app/BottomTabBar.tsx` — таб «Профиль» переключить `/settings` →
  `/profile`. `/settings` доступен через шестерёнку на `/profile`.
- `proxy.ts` — добавить `/profile` в `PROTECTED_PREFIXES`.
- `app/(app)/friends/[friendId]/page.tsx` — аватар сверху, гейт
  `getFriendProfile`/`areFriends` (R-7), read-only (тап-инфо работает,
  редактирования нет). Переиспользует `ProfileAvatar` с данными друга.

### 4. Ассет (параллельно, офлайн у владельца)

- Источник: Z-Anatomy Myology (Sketchfab, BY-SA). Кандидаты — в плане.
- Маппинг мешей модели → 14 ключей (JSON) + децимация под бюджет при нужде.
- `public/models/ATTRIBUTION.md` (BY-SA + кредит Z-Anatomy) + кредит-строка в UI.
- glb — runtime-cache в SW (`public/sw.js`), **не** precache (не раздувать
  установку PWA).

## Зависимости (новые)

`three`, `@react-three/fiber`, `@react-three/drei`. Версии под React 19 / Next 16
сверить через Context7 перед установкой.

## Перф-бюджет (CLAUDE.md крит #7: 60fps средние телефоны, 4× CPU throttle)

`frameloop=demand` (idle = 0 GPU), один draw на группу, **без bloom-постобработки
на мобайле** (фейк-свечение через emissive; реальный bloom — опционально только
десктоп), сжатый glb, ленивая загрузка. Тест на DevTools 4× CPU throttle.

## Решение по цветам vs R-36

R-36 запрещает hex в `className`. three.js принимает реальный цвет, не
Tailwind-класс — это другой носитель. Рампа heat-стопов живёт доменной
константой (single source) в `lib/domain/avatar/heat.ts`; зеркалится в CSS-vars
для DOM-частей панели. Документировано здесь как осознанное исключение.

## Порядок (вертикальные слайсы, каждый зелёный: typecheck+lint+test+build)

1. **Данные** — домен `heat.ts` (+ юнит-тесты), repo `muscleHeatProfile`,
   консолидация дублей + фикс AI-бага. Без 3D.
2. **Placeholder 3D + /profile** — deps, Canvas, цвет, тап, вращение, таб,
   proxy, R-37 состояния + Playwright smoke + visual regression.
3. **Друзья** — аватар на `/friends/[friendId]`, R-7.
4. **Ассет** — подбор/обработка реальной модели, подмена URL (параллельно).

## Риски

- Next 16 `ssr:false` правило → сверить в `node_modules/next/dist/docs`.
- Размер glb vs мобильный first-load → runtime-cache, не precache.
- Холодный старт baseline у новичка → явный empty-state.
- WebGL отсутствует/выключен → graceful fallback (статичная карта мышц списком).
- Цвета three vs R-36 → доменная константа, задокументировано.

## Тесты

- Домен: юнит на `heat.ts` (рампа, уровни, edge cases baseline=0 / no-history).
- Repo: `muscleHeatProfile` — db-bound, проверка на проде (локальный test-DB
  сломан — как и остальные repo в проекте).
- Playwright: `/profile` рендерит canvas, тап листает цикл; visual regression
  главного экрана.
