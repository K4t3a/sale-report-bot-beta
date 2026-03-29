-- 003_add_telegram_bind_fields.sql
-- Добавляем поля для безопасной привязки Telegram по одноразовому коду

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS telegram_bind_code TEXT,
  ADD COLUMN IF NOT EXISTS telegram_bind_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS telegram_bind_used_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS telegram_username TEXT,
  ADD COLUMN IF NOT EXISTS telegram_first_name TEXT,
  ADD COLUMN IF NOT EXISTS telegram_last_name TEXT;

-- Код должен быть уникальным, если он есть
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_telegram_bind_code
  ON users (telegram_bind_code)
  WHERE telegram_bind_code IS NOT NULL;

-- Telegram ID уже был unique в базовой схеме, но если вдруг нет — проверь отдельно
-- Этот индекс ускорит поиск по telegram_id
CREATE INDEX IF NOT EXISTS idx_users_telegram_id
  ON users (telegram_id);

-- Для админки удобно быстро искать активных пользователей по роли
CREATE INDEX IF NOT EXISTS idx_users_role_active
  ON users (role, is_active);