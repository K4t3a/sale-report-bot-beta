import { query } from "../../lib/db";

interface RegisterTelegramUserParams {
  telegramId: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

export async function registerTelegramUser(
  params: RegisterTelegramUserParams
) {
  const { telegramId, username, firstName, lastName } = params;

  const existingRes = await query<{
    id: number;
    username: string;
    telegramId: string | null;
    isActive: boolean;
    role: "ADMIN" | "VIEWER" | "ANALYST";
  }>(
    `
    SELECT id, username, telegram_id as "telegramId", is_active as "isActive", role
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
    username ||
    [firstName, lastName].filter(Boolean).join(" ") ||
    `tg_${telegramId}`;

  // Пытаемся вставить username; если занят, добавляем суффикс.
  let finalUsername = name;
  for (let attempt = 0; attempt < 5; attempt++) {
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

  // Фоллбек, если что-то пошло не так с уникальностью
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