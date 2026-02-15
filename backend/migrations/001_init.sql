-- 001_init.sql
-- Базовая схема БД для бета-версии (PostgreSQL).

-- Пользователи и роли
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  role          TEXT NOT NULL DEFAULT 'VIEWER' CHECK (role IN ('ADMIN', 'VIEWER')),
  telegram_id   TEXT UNIQUE,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Демонстрационные продажи (источник данных для отчётов в учебном проекте)
CREATE TABLE IF NOT EXISTS sale_demo (
  id        SERIAL PRIMARY KEY,
  customer  TEXT NOT NULL,
  product   TEXT NOT NULL,
  quantity  INT  NOT NULL CHECK (quantity > 0),
  price     NUMERIC(14,2) NOT NULL CHECK (price >= 0),
  sale_date TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sale_demo_sale_date ON sale_demo (sale_date);

-- Отчёты (шаблоны отчётности)
CREATE TABLE IF NOT EXISTS reports (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL UNIQUE,
  description  TEXT,
  period_type  TEXT NOT NULL CHECK (period_type IN ('DAY', 'WEEK', 'MONTH')),
  sql_template TEXT NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Расписания
CREATE TABLE IF NOT EXISTS schedules (
  id         SERIAL PRIMARY KEY,
  report_id  INT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  frequency  TEXT NOT NULL CHECK (frequency IN ('DAILY', 'WEEKLY')),
  hour       INT NOT NULL CHECK (hour >= 0 AND hour <= 23),
  minute     INT NOT NULL CHECK (minute >= 0 AND minute <= 59),
  weekday    INT CHECK (weekday >= 0 AND weekday <= 6),
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Связь расписаний и получателей
CREATE TABLE IF NOT EXISTS schedule_recipients (
  id          SERIAL PRIMARY KEY,
  schedule_id INT NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (schedule_id, user_id)
);

-- Логи доставки (в т.ч. для предотвращения дублей)
CREATE TABLE IF NOT EXISTS delivery_logs (
  id          SERIAL PRIMARY KEY,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  status      TEXT NOT NULL CHECK (status IN ('SUCCESS', 'ERROR')),
  error       TEXT,
  report_id   INT REFERENCES reports(id) ON DELETE SET NULL,
  user_id     INT REFERENCES users(id) ON DELETE SET NULL,
  schedule_id INT REFERENCES schedules(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_delivery_logs_sent_at ON delivery_logs (sent_at);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_schedule ON delivery_logs (schedule_id);

-- Триггер для updated_at
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_users_updated_at') THEN
    CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_reports_updated_at') THEN
    CREATE TRIGGER trg_reports_updated_at
    BEFORE UPDATE ON reports
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_schedules_updated_at') THEN
    CREATE TRIGGER trg_schedules_updated_at
    BEFORE UPDATE ON schedules
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sales_user') THEN
    CREATE ROLE sales_user WITH LOGIN PASSWORD 'sales_pass';
  END IF;
END$$;

DO $$
BEGIN
  GRANT USAGE, CREATE ON SCHEMA public TO sales_user;

  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sales_user;
  GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO sales_user;

  ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sales_user;

  ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO sales_user;
END$$;
