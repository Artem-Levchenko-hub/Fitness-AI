<div align="center">
  <img src="public/icons/icon-192.png" width="96" height="96" alt="Fitness AI">
  <h1>Fitness AI</h1>
  <p><strong>Тренировочный дневник, который помнит прогресс и превращает его в понятные решения.</strong></p>
  <p>
    Силовые, круговые и кардио-тренировки, Myo-reps, адаптивные шаблоны,
    10-сессионный AI-анализ, статистика, PWA и готовящийся Android-клиент.
  </p>
  <p>
    <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16.2-111111?logo=nextdotjs">
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white">
    <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql&logoColor=white">
    <img alt="PWA" src="https://img.shields.io/badge/PWA-installable-3A6B4A">
    <img alt="Tests" src="https://img.shields.io/badge/Vitest-1000%2B_tests-6E9F18?logo=vitest&logoColor=white">
  </p>
</div>

## Что умеет

| Тренировки | Аналитика | AI-тренер | Продукт |
|---|---|---|---|
| Силовые, круговые и кардио | Объём, 1RM, PR и группы мышц | Контекст последних 10 сессий | Windows installable PWA |
| Шаблоны и версии программ | Недельная активность и Myo-reps | Разбор завершённой тренировки | Offline shell и push |
| Myo-reps и таймер отдыха | Сон, питание и параметры тела | Диалог и follow-up по разбору | Android TWA release track |
| Дедупликация упражнений | Заметки как долговременная память | RAG по базе знаний | Друзья и публичный share |

## Платежи

Проект содержит тестово-готовый денежный контур на ЮKassa:

- пополнение рублёвого кошелька и списание за AI-ответы;
- месячная и годовая подписка Fitness AI Pro;
- сохранение способа оплаты у ЮKassa и управляемое автопродление;
- чеки, уведомления перед списанием, отмена и возобновление;
- server-to-server сверка каждого платежа и защита от двойного зачисления;
- recovery пропущенных webhook, полный возврат неиспользованного пополнения;
- тестовый/live guard и юридический fail-closed.

Live-платежи намеренно не включаются кодом. До них нужны договор с ЮKassa,
реквизиты оператора, проверенные юридические документы, тестовый чек и отдельное
подтверждение владельца.

Подробности:

- [Чек-лист подключения ЮKassa](docs/yookassa-launch-checklist.md)
- [Цена подписки и unit-экономика](docs/subscription-unit-economics-2026-07-30.md)
- [Обоснование Myo-reps](docs/myo-reps-evidence.md)

## Архитектура

```text
Next.js 16 App Router
├── Server Components + Route Handlers
├── Auth.js v5 + email magic links
├── PostgreSQL 15 + Drizzle ORM
├── Vercel AI SDK + OpenAI-compatible/Gemini providers
├── YooKassa REST API + webhook reconciliation
├── pm2 cron worker + nginx
└── PWA + Android Trusted Web Activity
```

Денежные значения хранятся только целыми копейками. Платёжное событие не меняет
баланс напрямую: приложение повторно получает объект у ЮKassa, сверяет ID,
сумму, RUB, владельца, metadata и test/live mode, затем применяет операцию в
транзакции PostgreSQL с row lock и уникальными ключами идемпотентности.

## Локальный запуск

Требования: Node.js 20+, pnpm и PostgreSQL 15+.

```bash
pnpm install
cp .env.example .env.local
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Откройте `http://localhost:3000`. Ключи и реквизиты ЮKassa для обычной
разработки не нужны: платежный UI останется безопасно выключенным.

## Проверка

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm e2e
```

Схема БД изменяется только миграциями:

```bash
pnpm db:generate
pnpm db:migrate
```

## Статус релиза

| Контур | Статус |
|---|---|
| Web/PWA | Рабочий self-hosted контур |
| YooKassa | Реализация готова к test shop, live закрыт флагами |
| Windows | Установка как PWA поддерживается |
| Android | TWA подготовлена, публикация Google Play требует отдельной проверки |
| Production billing | Только после юридической и финансовой приёмки владельцем |

## Безопасность

Не коммитьте `.env.local`, `.env.production`, ключи ЮKassa, Resend, AI,
`AUTH_SECRET` или Android keystore. О найденной уязвимости сообщайте владельцу
репозитория приватно, без публикации рабочего эксплойта.
