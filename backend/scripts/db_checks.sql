-- 1. Проверка создания отчета

-- 1.1. Проверка, что запись появилась
SELECT COUNT(*) AS report_count
FROM reports
WHERE period_type = 'DAY';

-- 1.2. Проверка последних добавленных отчетов
SELECT id, period_type, created_at, is_active
FROM reports
ORDER BY created_at DESC
LIMIT 5;

-- 1.3. Проверка конкретных полей у последнего отчета
SELECT id, period_type, is_active
FROM reports
ORDER BY created_at DESC
LIMIT 1;

-- Ожидаемо:
-- period = 'WEEK'
-- period_type = 'true'

-- 2. Проверка запуска отчета

-- 2.1. Проверка статуса отчета после запуска
SELECT id, is_active, updated_at
FROM reports
WHERE id = 1;

-- Ожидаемо:
-- is_active = 'true'

-- 2.2. Проверка появления записи в логах по отчету
SELECT COUNT(*) AS log_count
FROM delivery_logs
WHERE report_id = 1;

-- 2.3. Последние логи по отчету
SELECT id, report_id, status, sent_at
FROM delivery_logs
WHERE report_id = 1
ORDER BY sent_at DESC
LIMIT 10;

-- 3. Проверка создания расписания

-- 3.1. Проверка, что новое расписание появилось
SELECT COUNT(*) AS schedule_count
FROM schedules
WHERE report_id = 1
  AND frequency = 'DAILY';



-- 3.2. Проверка корректности полей
SELECT id, schedule_id, user_id
FROM schedule_recipients
WHERE id = 1;

-- 4. Проверка удаления расписания

-- 4.1. Проверка, что расписание удалилось
SELECT COUNT(*) AS deleted_schedule_count
FROM schedules
WHERE id = 1;

-- Ожидаемо:
-- 0

-- 4.2. Проверка зависимых записей (если есть связь schedule_id в logs)
SELECT COUNT(*) AS orphan_logs_count
FROM logs
WHERE schedule_id = 14;


-- Ожидаемо:
-- 0, если каскадное удаление настроено
-- либо записи остаются, но ссылка не должна быть битой, если ON DELETE SET NULL

-- 5. Проверка привязки Telegram

-- 5.1. Проверка, что пользователь с telegram появился/обновился
SELECT COUNT(*) AS telegram_user_count
FROM users
WHERE = username = 'admin';

-- 5.2. Проверка конкретных полей
SELECT id, username, role, telegram_id
FROM users
WHERE username = 'admin';


-- Ожидаемо:
-- telegram_username = 'admin'
-- telegram_id не NULL

-- 5.3. Проверка списка активных пользователей с Telegram
SELECT id, username, role, telegram_id
FROM users
WHERE telegram_id IS NOT NULL
ORDER BY id DESC;

-- 6.1. Количество новых логов
SELECT COUNT(*) AS total_logs
FROM delivery_logs;

-- 6.2. Последние записи логов
SELECT id, user_id, report_id, schedule_id, status, sent_at
FROM delivery_logs
ORDER BY sent_at DESC
LIMIT 10;

-- 6.3. Проверка успешных доставок
SELECT COUNT(*) AS success_logs
FROM delivery_logs
WHERE status = 'SUCCESS';

-- 6.4. Проверка неуспешных доставок
SELECT COUNT(*) AS failed_logs
FROM delivery_logs
WHERE status = 'FAILED';

-- 7. Проверка обязательных полей

-- 7.1. Отчеты без периода
SELECT id
FROM reports
WHERE period_type IS NULL;

-- 7.2. Пользователи с пустым username
SELECT id
FROM users
WHERE username IS NULL OR username = '';

-- 8.4. Логи без статуса
SELECT id
FROM delivery_logs
WHERE status IS NULL OR status = '';