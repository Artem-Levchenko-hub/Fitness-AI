# Переход Fitness AI на fitnesss.online

Канонический публичный адрес: `https://fitnesss.online`.

## Целевая схема

- `fitnesss.online` и `www.fitnesss.online` указывают на `170.168.72.200`;
- `www` перенаправляет на apex с кодом 301;
- приложение работает в отдельном release-каталоге и отдельном PM2-процессе;
- nginx передаёт `Host`, `X-Real-IP`, `X-Forwarded-For` и
  `X-Forwarded-Proto`, а TLS выпускается Certbot;
- старый `app.lead-generator.ru` после smoke-проверки перенаправляет на новый
  домен, сохраняя path и query string;
- webhook ЮKassa: `https://fitnesss.online/api/yookassa/webhook`;
- Android Digital Asset Links:
  `https://fitnesss.online/.well-known/assetlinks.json`.
- отправитель magic-link писем после верификации Resend:
  `Fitness AI <noreply@mail.fitnesss.online>`.

Существующий грязный checkout `/opt/fitness-saas` нельзя сбрасывать или
перезаписывать. Новый релиз сначала проверяется на отдельном localhost-порту.

## DNS

| Имя | Тип | Значение |
|---|---|---|
| `@` | `A` | `170.168.72.200` |
| `www` | `CNAME` | `fitnesss.online.` |

Удалить конфликтующие парковочные записи apex/`www`. После изменения проверить
ответы авторитетных NS `ns1.reg.ru` и `ns2.reg.ru`, затем публичные резолверы.

## Production env

```dotenv
AUTH_URL=https://fitnesss.online
AUTH_TRUST_HOST=true
NEXT_PUBLIC_APP_URL=https://fitnesss.online
YOOKASSA_MODE=live
YOOKASSA_WEBHOOK_IP_CHECK=true
BILLING_ENABLED=true
SUBSCRIPTION_ENABLED=true
```

Последние четыре значения включаются только после добавления боевых ключей,
реквизитов продавца, подтверждённой оферты, чеков и автоплатежей. До этого
контур обязан оставаться fail-closed.

## Smoke после переключения

1. `GET /`, `/login`, `/manifest.webmanifest`, `/robots.txt`, `/sitemap.xml`.
2. `GET /api/health`: БД `up`, ожидаемый test/live billing status.
3. Magic-link вход, dashboard и одна read-only тренировка.
4. Android `assetlinks.json`, APK signature и запуск без панели Custom Tab.
5. Тестовый платёж, повторный webhook, пропущенный webhook/reconcile.
6. Минимальный реальный платёж и полный возврат с проверкой чека и ledger.
7. Старый домен отдаёт 301 на тот же путь нового домена.

## Релиз

- Web: точный проверенный commit из `master`.
- Windows: `Vibe-trainer-Windows-x64-Setup-v1.1.0.exe`.
- Android: `Vibe-trainer-Android-v1.1.0.apk` и AAB для Google Play.
- Каталожные цены: 990 ₽/месяц и 9 990 ₽/год.
