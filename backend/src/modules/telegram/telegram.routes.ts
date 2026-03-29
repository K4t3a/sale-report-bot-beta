import { Router } from "express";
import { query } from "../../lib/db";
import { bindTelegramAccountByCode } from "../users/user.service";

const router = Router();

router.post("/bind", async (req, res) => {
  try {
    const {
      code,
      telegramId,
      telegramUsername,
      telegramFirstName,
      telegramLastName,
    } = req.body as {
      code?: string;
      telegramId?: string;
      telegramUsername?: string | null;
      telegramFirstName?: string | null;
      telegramLastName?: string | null;
    };

    if (!code || !telegramId) {
      return res.status(400).json({
        message: "Не передан код или Telegram ID",
      });
    }

    const user = await bindTelegramAccountByCode({
      code: code.trim().toUpperCase(),
      telegramId: telegramId.trim(),
      telegramUsername: telegramUsername?.trim() || null,
      telegramFirstName: telegramFirstName?.trim() || null,
      telegramLastName: telegramLastName?.trim() || null,
    });

    if (!user) {
      return res.status(400).json({
        message: "Код недействителен, истёк или уже использован",
      });
    }

    return res.json({
      message: "Telegram успешно привязан",
      user,
    });
  } catch (err: unknown) {
    const pgError = err as { code?: string };

    if (pgError?.code === "23505") {
      return res.status(409).json({
        message: "Этот Telegram-аккаунт уже привязан к другому пользователю",
      });
    }

    console.error("POST /api/telegram/bind error", err);

    return res.status(500).json({
      message: "Ошибка привязки Telegram",
    });
  }
});

router.get("/me/:telegramId", async (req, res) => {
  try {
    const telegramId = String(req.params.telegramId);

    const result = await query<{
      id: number;
      username: string;
      role: "ADMIN" | "ANALYST" | "VIEWER";
      isActive: boolean;
      telegramId: string | null;
    }>(
      `
      SELECT
        id,
        username,
        role,
        is_active as "isActive",
        telegram_id as "telegramId"
      FROM users
      WHERE telegram_id = $1
        AND is_active = TRUE
      LIMIT 1
      `,
      [telegramId]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({
        message: "Пользователь не привязан",
      });
    }

    return res.json({ user });
  } catch (err) {
    console.error("GET /api/telegram/me/:telegramId error", err);

    return res.status(500).json({
      message: "Ошибка получения статуса привязки",
    });
  }
});

router.post("/unbind", async (req, res) => {
  try {
    const { telegramId } = req.body as { telegramId?: string };

    if (!telegramId) {
      return res.status(400).json({
        message: "Не передан Telegram ID",
      });
    }

    const result = await query<{
      id: number;
      username: string;
      role: "ADMIN" | "ANALYST" | "VIEWER";
    }>(
      `
      UPDATE users
      SET
        telegram_id = NULL,
        telegram_username = NULL,
        telegram_first_name = NULL,
        telegram_last_name = NULL
      WHERE telegram_id = $1
      RETURNING id, username, role
      `,
      [telegramId.trim()]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({
        message: "Аккаунт не был привязан",
      });
    }

    return res.json({
      message: "Telegram успешно отвязан",
      user,
    });
  } catch (err) {
    console.error("POST /api/telegram/unbind error", err);

    return res.status(500).json({
      message: "Ошибка отвязки Telegram",
    });
  }
});

export default router;