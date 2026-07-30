# Руководство разработчика

## Требования

- Node.js 20+
- pnpm 9+
- PostgreSQL 15+
- Git

Redis нужен для production rate limiting, но не обязателен для первого
локального запуска.

## Установка

```bash
git clone https://github.com/Artem-Levchenko-hub/Fitness-AI.git
cd Fitness-AI
pnpm install
cp .env.example .env.local
```

Запустите локальный PostgreSQL любым удобным способом. Пример с Docker:

```bash
docker run -d --name fitness-pg -p 5432:5432 \
  -e POSTGRES_USER=fitness \
  -e POSTGRES_PASSWORD=fitness \
  -e POSTGRES_DB=fitness_saas \
  postgres:15-alpine
```

Минимально заполните в `.env.local`:

- `DATABASE_URL`;
- `AUTH_SECRET`;
- `RESEND_API_KEY` и `EMAIL_FROM` для реального входа по email;
- один AI-провайдер, если тестируете AI-функции.

Полный список и комментарии находятся в `.env.example`.

## База данных и запуск

```bash
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Приложение откроется на [http://localhost:3000](http://localhost:3000).

Схема изменяется только через Drizzle:

```bash
pnpm db:generate
pnpm db:migrate
```

Не редактируйте уже применённую миграцию. Создавайте новую и проверяйте её на
копии данных.

## Проверки

Перед pull request выполните:

```bash
pnpm typecheck
pnpm lint
pnpm test
SKIP_ENV_VALIDATION=1 pnpm build
```

Для пользовательских сценариев:

```bash
pnpm e2e
```

## Платежи в разработке

По умолчанию используйте:

```dotenv
YOOKASSA_MODE=test
BILLING_ENABLED=false
SUBSCRIPTION_ENABLED=false
LEGAL_DOCUMENTS_APPROVED=false
```

Сначала получите тестовый магазин, затем включайте возможности по одной.
Никогда не используйте live-ключи в локальном репозитории, CI, Issues или
скриншотах. Полный процесс описан в
[чек-листе ЮKassa](yookassa-launch-checklist.md).

## Основные каталоги

```text
app/          страницы, Server Components и Route Handlers
components/   переиспользуемый интерфейс
db/           схема, миграции и seed
lib/          доменная логика, AI и платежи
public/       PWA, модели и демонстрации упражнений
docs/         пользовательская и техническая документация
```

Следующий шаг: [CONTRIBUTING.md](../CONTRIBUTING.md).
