import { query } from "../../lib/db";
import { generateTelegramBindCode } from "../../utils/telegramBindCode";

// Единый набор ролей для всего проекта.
// ADMIN — полный доступ к панели,
// ANALYST — работа с отчетами и аналитикой,
// VIEWER — пользователь Telegram без доступа в web-панель.
type UserRole = "ADMIN" | "ANALYST" | "VIEWER";

interface RegisterTelegramUserParams {
  telegramId: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

interface BindTelegramAccountParams {
  code: string;
  telegramId: string;
  telegramUsername?: string | null;
  telegramFirstName?: string | null;
  telegramLastName?: string | null;
}

// Регистрация Telegram-пользователя по telegramId.
// Пока оставляем этот сценарий для совместимости,
// но основной безопасный вариант дальше будет через bind code.
export async function registerTelegramUser(
  params: RegisterTelegramUserParams
) {
  const { telegramId, username, firstName, lastName } = params;

  const existingRes = await query<{
    id: number;
    username: string;
    telegramId: string | null;
    isActive: boolean;
    role: UserRole;
  }>(
    `
    SELECT
      id,
      username,
      telegram_id as "telegramId",
      is_active as "isActive",
      role
    FROM users
    WHERE telegram_id = $1
    LIMIT 1
    `,
    [telegramId]
  );

  const existing = existingRes.rows[0];

  if (existing) {
    return existing;
  }

  const name =
    username?.trim() ||
    [firstName, lastName].filter(Boolean).join(" ").trim() ||
    `tg_${telegramId}`;

  let finalUsername = name;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const inserted = await query<{
        id: number;
        username: string;
      }>(
        `
        INSERT INTO users (telegram_id, username, is_active, role)
        VALUES ($1, $2, TRUE, 'VIEWER')
        RETURNING id, username
        `,
        [telegramId, finalUsername]
      );

      return inserted.rows[0];
    } catch (e: any) {
      // 23505 = unique_violation
      if (e?.code === "23505") {
        finalUsername = `${name}_${telegramId}`;
        continue;
      }

      throw e;
    }
  }

  const inserted = await query<{
    id: number;
    username: string;
  }>(
    `
    INSERT INTO users (telegram_id, username, is_active, role)
    VALUES ($1, $2, TRUE, 'VIEWER')
    RETURNING id, username
    `,
    [telegramId, `tg_${telegramId}`]
  );

  return inserted.rows[0];
}

// Генерация одноразового кода привязки Telegram.
// Код живет 15 минут. Старый код перезаписывается новым.
export async function createTelegramBindCode(userId: number) {
  const code = generateTelegramBindCode(6);

  const result = await query<{
    id: number;
    username: string;
    telegramBindCode: string | null;
    telegramBindExpiresAt: string | null;
  }>(
    `
    UPDATE users
    SET
      telegram_bind_code = $2,
      telegram_bind_expires_at = now() + interval '15 minutes',
      telegram_bind_used_at = NULL
    WHERE id = $1
      AND is_active = TRUE
    RETURNING
      id,
      username,
      telegram_bind_code as "telegramBindCode",
      telegram_bind_expires_at as "telegramBindExpiresAt"
    `,
    [userId, code]
  );

  return result.rows[0] || null;
}

// Привязка Telegram-аккаунта по одноразовому коду.
// Если код валиден, сохраняем telegram_id и данные профиля,
// затем сразу очищаем код, чтобы его нельзя было использовать повторно.
export async function bindTelegramAccountByCode(
  params: BindTelegramAccountParams
) {
  const {
    code,
    telegramId,
    telegramUsername,
    telegramFirstName,
    telegramLastName,
  } = params;

  const result = await query<{
    id: number;
    username: string;
    role: UserRole;
  }>(
    `
    UPDATE users
    SET
      telegram_id = $2,
      telegram_username = $3,
      telegram_first_name = $4,
      telegram_last_name = $5,
      telegram_bind_used_at = now(),
      telegram_bind_code = NULL,
      telegram_bind_expires_at = NULL
    WHERE telegram_bind_code = $1
      AND is_active = TRUE
      AND telegram_bind_used_at IS NULL
      AND telegram_bind_expires_at IS NOT NULL
      AND telegram_bind_expires_at > now()
    RETURNING id, username, role
    `,
    [code, telegramId, telegramUsername, telegramFirstName, telegramLastName]
  );

  return result.rows[0] || null;
}