-- 002_expand_roles.sql
-- Расширяем ролевую модель до ADMIN / ANALYST / VIEWER
-- Нужна для уже развернутой БД, чтобы не пересоздавать таблицы.

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('ADMIN', 'ANALYST', 'VIEWER'));