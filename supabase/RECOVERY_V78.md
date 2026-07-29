# CRYPTO LAB v78 — восстановление

Стабильная версия: v78.

## Что хранится в GitHub

- `index.html` — сайт CRYPTO LAB v78
- `supabase/functions/crypto-signal-register/index.ts`
- `supabase/functions/crypto-signal-monitor/index.ts`
- `supabase/migrations/crypto_signal_monitors_v78.sql`
- `supabase/migrations/crypto_signal_monitor_cron_v78.sql`
- `register_crypto_signal_v78.sql`

## Порядок восстановления

1. Создать проект Supabase.
2. Выполнить `crypto_signal_monitors_v78.sql`.
3. Выполнить `register_crypto_signal_v78.sql`.
4. Создать и развернуть Edge Function `crypto-signal-register`.
5. Создать и развернуть Edge Function `crypto-signal-monitor`.
6. Добавить необходимые Secrets в Supabase.
7. Создать в Vault секрет `MONITOR_SECRET`.
8. Выполнить `crypto_signal_monitor_cron_v78.sql`.
9. У обеих Edge Functions выключить Verify JWT.
10. Проверить Invocations: статус 200.
11. Проверить Telegram-события: вход, TP1, TP2, TP3 и Stop Loss.

## Secrets

Значения секретов в GitHub не сохраняются.

Необходимые имена:

- `SUPABASE_SERVICE_ROLE_KEY`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `MONITOR_SECRET`
- publishable key для `crypto-signal-register`

## Проверенное состояние v78

- Telegram AUTO отправляет новые сигналы класса A.
- Активные сигналы повторно не отправляются.
- Дубли в таблице не создаются.
- Серверный монитор запускается каждую минуту.
- Проверены события входа, TP1, TP2, TP3 и Stop Loss.
