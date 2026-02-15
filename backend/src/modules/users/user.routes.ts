import { Router } from "express";
import { query } from "../../lib/db";
import { registerTelegramUser } from "./user.service";

const router = Router();

interface TelegramRegisterBody {
  telegramId?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
}

router.post("/telegram-register", async (req, res) => {
  try {
    const body = req.body as TelegramRegisterBody;

    if (!body.telegramId) {
      res.status(400).json({ message: "telegramId is required" });
      return;
    }

    const user = await registerTelegramUser({
      telegramId: body.telegramId,
      username: body.username,
      firstName: body.firstName,
      lastName: body.lastName,
    });

    res.json({
      id: user.id,
      username: user.username,
    });
  } catch (error) {
    console.error("telegram-register error", error);
    res
      .status(500)
      .json({ message: "Ошибка регистрации Telegram-пользователя" });
  }
});

router.post("/telegram-bind", async (req, res) => {
  try {
    const { code, telegramId, username, firstName, lastName } = req.body as {
      code?: string;
      telegramId?: string;
      username?: string;
      firstName?: string;
      lastName?: string;
    };

    if (!code || !telegramId) {
      res
        .status(400)
        .json({ message: "code и telegramId обязательны для привязки" });
      return;
    }

  
    const userToBindRes = await query<{
      id: number;
      username: string;
    }>(
      `SELECT id, username FROM users WHERE username = $1 LIMIT 1`,
      [code]
    );
    const userToBind = userToBindRes.rows[0];

    if (!userToBind) {
      res.status(404).json({
        message:
          "Пользователь с таким кодом не найден. Проверьте код или обратитесь к администратору.",
      });
      return;
    }

    const existingTelegramRes = await query<{
      id: number;
      username: string;
    }>(
      `SELECT id, username FROM users WHERE telegram_id = $1 LIMIT 1`,
      [telegramId]
    );
    const existingTelegram = existingTelegramRes.rows[0];

    if (existingTelegram && existingTelegram.id !== userToBind.id) {
      res.status(409).json({
        message: `Этот Telegram уже привязан к пользователю "${existingTelegram.username}". Сначала отвяжите его или обратитесь к администратору.`,
      });
      return;
    }

    
    const updatedRes = await query<{
      id: number;
      username: string;
      telegramId: string | null;
    }>(
      `
      UPDATE users
      SET telegram_id = $1
      WHERE id = $2
      RETURNING id, username, telegram_id as "telegramId"
      `,
      [telegramId, userToBind.id]
    );
    const updated = updatedRes.rows[0];

    res.json({
      id: updated.id,
      username: updated.username,
      telegramId: updated.telegramId,
    });
  } catch (err: any) {
    console.error("telegram-bind error", err);
    res.status(500).json({ message: "Внутренняя ошибка при привязке Telegram" });
  }
});

router.get("/telegram", async (req, res) => {
  try {
    const usersRes = await query<{
      id: number;
      username: string;
      telegramId: string;
    }>(
      `
      SELECT id, username, telegram_id as "telegramId"
      FROM users
      WHERE is_active = TRUE AND telegram_id IS NOT NULL
      ORDER BY id ASC
      `
    );
    const users = usersRes.rows;

    res.json(users);
  } catch (err) {
    console.error("get telegram users error", err);
    res.status(500).json({ message: "Ошибка получения пользователей" });
  }
});

export default router;
