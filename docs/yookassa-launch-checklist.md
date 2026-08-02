# Fitness AI — подключение ЮKassa и официальный запуск

Этот чек-лист готовит тестовый и боевой магазин. Боевой режим и Google Play
включаются только после выполнения юридических, кассовых и платёжных проверок.

## Что уже реализовано

- одноразовое пополнение реального рублёвого баланса;
- месячная и годовая подписка;
- сохранение способа оплаты только у ЮKassa;
- автоматическое продление через server cron;
- email-напоминание за 3 дня до месячного и за 7 дней до годового продления;
- отмена и возобновление автопродления;
- admin-only полный возврат неиспользованного пополнения;
- receipt с email, услугой, `full_payment` и `vat_code`;
- durable client idempotency key;
- server-to-server `GET /payments/{id}` перед любым зачислением;
- сверка payment ID, `paid`, статуса, RUB, суммы, metadata и test/live mode;
- транзакционный row lock и DB unique index для exactly-once;
- recovery пропущенного webhook через return-page и hourly reconcile;
- тестовый/live mode guard;
- fail-closed legal/payment readiness;
- `/api/health` без секретов.

## 1. Регистрация

1. Зарегистрировать ИП/ООО/самозанятого в допустимой для выбранного сценария
   форме.
2. Создать магазин ЮKassa: <https://yookassa.ru/joinups>.
3. Выбрать приём платежей по API, redirect/«Умный платёж».
4. Подключить «Чеки от ЮKassa» либо согласовать стороннюю онлайн-кассу.
5. Попросить менеджера включить **автоплатежи / сохранение способа оплаты** для
   боевого магазина. В тестовом магазине они доступны по умолчанию.
6. Получить test `shopId` и `secretKey`.

Для самозанятого отдельно согласовать фискальный сценарий: ЮKassa прекратила
свой прежний сервис автоматической регистрации чеков НПД 29 декабря 2025 года.
Принимать оплату можно только после того, как бухгалтер и ЮKassa подтвердят,
как именно будут формироваться чеки «Мой налог». «Чеки от ЮKassa» для 54-ФЗ
ориентированы на ИП и юридических лиц.

Документация автоплатежей:
<https://yookassa.ru/developers/payment-acceptance/scenario-extensions/recurring-payments/save-payment-method/save-during-payment>

## 2. Тестовые переменные

В secret env общего dev-сервера:

```dotenv
YOOKASSA_SHOP_ID=<test shop id>
YOOKASSA_SECRET_KEY=<test secret>
YOOKASSA_MODE=test
YOOKASSA_VAT_CODE=1
YOOKASSA_WEBHOOK_IP_CHECK=false

LEGAL_OPERATOR_NAME=<полное имя ИП/ООО/самозанятого>
LEGAL_OPERATOR_INN=<10 или 12 цифр>
LEGAL_OPERATOR_REGISTRATION_ID=<ОГРН/ОГРНИП, если применимо>
LEGAL_OPERATOR_ADDRESS=<адрес>
LEGAL_SUPPORT_EMAIL=<email поддержки>
LEGAL_OFFER_VERSION=2026-07-30
LEGAL_DOCUMENTS_APPROVED=false

BILLING_ENABLED=false
SUBSCRIPTION_ENABLED=false
AI_COACH_PRICE_KOPECKS=2200
CRON_SECRET=<случайная строка длиной не менее 16 символов>
```

Сначала оставьте три флага `LEGAL_DOCUMENTS_APPROVED`, `BILLING_ENABLED`,
`SUBSCRIPTION_ENABLED` выключенными.

## 3. Юридические тексты

Заполнить реквизиты и проверить:

- `/legal/offer`;
- `/legal/privacy`;
- правила возврата;
- медицинский disclaimer;
- основание обработки тренировочных/телесных данных;
- список AI, email, hosting и payment processors;
- локализацию и трансграничную передачу персональных данных;
- сроки хранения фискальных документов;
- уведомление Роскомнадзора, если оно требуется.

После проверки владельцем/юристом:

```dotenv
LEGAL_DOCUMENTS_APPROVED=true
```

До этого checkout закрыт программно.

## 4. Webhook тестового магазина

В кабинете ЮKassa → Интеграция → HTTP-уведомления:

```text
https://fitnesss.online/api/yookassa/webhook
```

Включить:

- `payment.succeeded`;
- `payment.waiting_for_capture`;
- `payment.canceled`.
- `refund.succeeded`.

Требуются HTTPS, порт 443/8443 и TLS 1.2+. Webhook повторяется до 24 часов при
non-200. Источник:
<https://yookassa.ru/developers/using-api/webhooks>.

В test mode IP-проверка может быть выключена, потому что обработчик всё равно
получает истинный объект через Basic-auth GET. Перед live:

1. nginx должен **перезаписывать**, а не дописывать пользовательский
   `X-Real-IP`;
2. проверить IPv4 и IPv6 allowlist;
3. включить `YOOKASSA_WEBHOOK_IP_CHECK=true`.

## 5. Миграция и тестовый deploy

На общем сервере рекомендуется отдельный release/worktree и отдельный pm2
процесс, чтобы test shop не заменял текущую публичную сборку:

```bash
pnpm db:migrate
pnpm build
PM2_APP_NAME=fitness-saas-dev PORT=3002 \
  pm2 start ecosystem.config.cjs --only fitness-saas-dev --update-env
```

Cron должен вызывать:

- `/api/cron/payments-reconcile`;
- `/api/cron/subscriptions`.

Проверка:

```bash
curl -fsS https://fitnesss.online/api/health
```

Ожидаемо в test mode после включения флагов:

```json
{
  "ok": true,
  "database": "up",
  "billing": {
    "mode": "test",
    "paymentsReady": true,
    "subscriptionsReady": true
  }
}
```

## 6. Матрица тестов

1. Успешное пополнение 330 ₽ → одна payment, одна ledger entry, баланс +330 ₽.
2. Двойная доставка webhook → баланс меняется один раз.
3. Два конкурентных webhook → unique index/row lock не дают двойное
   зачисление.
4. Подмена суммы/RUB/metadata → HTTP 409, баланс не меняется.
5. Provider API недоступен → HTTP 503, ЮKassa повторяет уведомление.
6. Возврат на `/billing?payment=...` → статус сверяется с ЮKassa, не доверяет
   query string.
7. Пропущенный webhook → hourly reconcile завершает платёж.
8. Месячная подписка → `tier=pro`, период +1 calendar month, method saved.
9. 31 января → период заканчивается в последний день февраля; следующий —
   последний день марта.
10. Годовая подписка → период +1 calendar year.
11. Отключение → доступ остаётся, `next_charge_at=null`.
12. Возобновление до конца периода → `next_charge_at=current_period_end`.
13. Renewal с saved method → новый receipt и период ровно один раз.
14. До renewal уходит одно письмо с точной датой, суммой и ссылкой отмены.
15. Три неуспешных renewal → `past_due`, дальнейшие списания прекращены.
16. Test provider object в live mode и наоборот → отклоняется.
17. Чек виден в кабинете ЮKassa и приходит на email пользователя.
18. Admin refund неиспользованного top-up → ЮKassa `succeeded`, баланс
    уменьшается ровно один раз, ledger получает `refund`, платёж — `refunded`.
19. Если пополненные средства уже потрачены, автоматический полный возврат
    блокируется и передаётся на ручное рассмотрение.
20. Полный возврат последнего платежа подписки из кабинета ЮKassa отключает
    доступ и автопродление, но не изменяет рублёвый баланс.

## 7. Android и Google Play

ЮKassa подходит для web/PWA и APK, распространяемого напрямую. Для пользователей
Google Play в России Google сейчас приостановил Play Billing и отдельно указывает,
что требование использовать его не применяется к принимающим оплату приложениям.
Для пользователей за пределами России остаются общая Payments policy и
региональные программы alternative/user-choice billing. До публикации в Play:

1. проверить актуальную политику Google Play для региона распространения;
2. решить, будет Android-клиент consumption-only или получит Play Billing;
3. не показывать YooKassa checkout в Play-сборке без подтверждённого основания;
4. отдельно получить подтверждение владельца на публикацию.

Актуальные официальные источники:

- <https://support.google.com/googleplay/android-developer/answer/11950272>;
- <https://support.google.com/googleplay/android-developer/answer/9858738>;
- <https://support.google.com/googleplay/android-developer/answer/13821247>.

## 8. Переход в live

Только после отдельного подтверждения владельца:

1. сделать резервную копию БД;
2. заменить test ключи на live;
3. сверить договорную комиссию и код НДС с бухгалтером;
4. подтвердить автоплатежи у менеджера ЮKassa;
5. проверить live webhook;
6. установить:

```dotenv
YOOKASSA_MODE=live
YOOKASSA_WEBHOOK_IP_CHECK=true
BILLING_ENABLED=true
SUBSCRIPTION_ENABLED=true
```

7. провести один минимальный реальный платёж владельцем;
8. проверить payment, чек, ledger, баланс/подписку и банковскую выписку;
9. провести тестовый возврат из кабинета по утверждённой политике;
10. только после сверки открыть checkout пользователям.

Боевые ключи нельзя коммитить, передавать в браузер, писать в логи или
отправлять в этот документ.
