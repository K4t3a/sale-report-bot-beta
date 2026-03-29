import { Router } from "express";
import bcrypt from "bcrypt";
import { query } from "../../lib/db";
import { createTelegramBindCode } from "./user.service";
import { requireAuth, requireRoles } from "../../middleware/auth";

const router = Router();

type UserRole = "ADMIN" | "ANALYST" | "VIEWER";

type UserRow = {
  id: number;
  username: string;
  role: UserRole;
  isActive: boolean;
  telegramId: string | null;
  bindCode: string | null;
  bindCodeExpiresAt: string | null;
  createdAt: string;
};

router.use(requireAuth);

/**
 * Список пользователей панели.
 * Доступ только для ADMIN.
 */
router.get("/", requireRoles("ADMIN"), async (_req, res) => {
  try {
    const result = await query<UserRow>(
      `
      SELECT
        id,
        username,
        role,
        is_active as "isActive",
        telegram_id as "telegramId",
        telegram_bind_code as "bindCode",
        telegram_bind_expires_at as "bindCodeExpiresAt",
        created_at as "createdAt"
      FROM users
      ORDER BY id ASC
      `
    );

    return res.json(result.rows);
  } catch (err) {
    console.error("GET /api/users error", err);

    return res.status(500).json({
      message: "Ошибка получения пользователей",
    });
  }
});

/**
 * Список активных пользователей с привязанным Telegram.
 * Нужен для расписаний.
 * Доступ: ADMIN и ANALYST.
 */
router.get("/telegram", requireRoles("ADMIN", "ANALYST"), async (_req, res) => {
  try {
    const usersRes = await query<{
      id: number;
      username: string;
      telegramId: string;
    }>(
      `
      SELECT
        id,
        username,
        telegram_id as "telegramId"
      FROM users
      WHERE is_active = TRUE
        AND telegram_id IS NOT NULL
      ORDER BY id ASC
      `
    );

    return res.json(usersRes.rows);
  } catch (err) {
    console.error("GET /api/users/telegram error", err);

    return res.status(500).json({
      message: "Ошибка получения пользователей",
    });
  }
});

/**
 * Создание пользователя из админ-панели.
 * Доступ: только ADMIN.
 */
router.post("/", requireRoles("ADMIN"), async (req, res) => {
  try {
    const {
      username,
      password,
      role,
      isActive,
    } = (req.body ?? {}) as {
      username?: string;
      password?: string;
      role?: UserRole;
      isActive?: boolean;
    };

    const safeUsername = username?.trim();
    const safePassword = password?.trim();
    const safeRole: UserRole =
      role === "ADMIN" || role === "ANALYST" || role === "VIEWER"
        ? role
        : "VIEWER";

    if (!safeUsername || safeUsername.length < 3) {
      return res.status(400).json({
        message: "Логин должен содержать минимум 3 символа",
      });
    }

    if (!safePassword || safePassword.length < 4) {
      return res.status(400).json({
        message: "Пароль должен содержать минимум 4 символа",
      });
    }

    const existsRes = await query<{ id: number }>(
      `
      SELECT id
      FROM users
      WHERE username = $1
      LIMIT 1
      `,
      [safeUsername]
    );

    if (existsRes.rows[0]) {
      return res.status(409).json({
        message: "Пользователь с таким логином уже существует",
      });
    }

    const passwordHash = await bcrypt.hash(safePassword, 10);

    const insertRes = await query<UserRow>(
      `
      INSERT INTO users (
        username,
        password_hash,
        role,
        is_active
      )
      VALUES ($1, $2, $3, $4)
      RETURNING
        id,
        username,
        role,
        is_active as "isActive",
        telegram_id as "telegramId",
        telegram_bind_code as "bindCode",
        telegram_bind_expires_at as "bindCodeExpiresAt",
        created_at as "createdAt"
      `,
      [safeUsername, passwordHash, safeRole, isActive ?? true]
    );

    return res.status(201).json(insertRes.rows[0]);
  } catch (err: any) {
    if (err?.code === "23505") {
      return res.status(409).json({
        message: "Пользователь с таким логином уже существует",
      });
    }

    console.error("POST /api/users error", err);

    return res.status(500).json({
      message: "Ошибка создания пользователя",
    });
  }
});

/**
 * Переключение активности пользователя.
 * Доступ: только ADMIN.
 */
router.patch("/:id/status", requireRoles("ADMIN"), async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const { isActive } = (req.body ?? {}) as { isActive?: boolean };

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        message: "Некорректный ID пользователя",
      });
    }

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        message: "Поле isActive обязательно",
      });
    }

    const updateRes = await query<UserRow>(
      `
      UPDATE users
      SET is_active = $2
      WHERE id = $1
      RETURNING
        id,
        username,
        role,
        is_active as "isActive",
        telegram_id as "telegramId",
        telegram_bind_code as "bindCode",
        telegram_bind_expires_at as "bindCodeExpiresAt",
        created_at as "createdAt"
      `,
      [userId, isActive]
    );

    const user = updateRes.rows[0];

    if (!user) {
      return res.status(404).json({
        message: "Пользователь не найден",
      });
    }

    return res.json(user);
  } catch (err) {
    console.error("PATCH /api/users/:id/status error", err);

    return res.status(500).json({
      message: "Ошибка обновления статуса пользователя",
    });
  }
});

/**
 * Генерация одноразового bind code.
 * Доступ: только ADMIN.
 */
router.post("/:id/telegram-bind-code", requireRoles("ADMIN"), async (req, res) => {
  try {
    const userId = Number(req.params.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        message: "Некорректный ID пользователя",
      });
    }

    const bindData = await createTelegramBindCode(userId);

    if (!bindData) {
      return res.status(404).json({
        message: "Пользователь не найден или неактивен",
      });
    }

    return res.json({
      message: "Код привязки сгенерирован",
      data: bindData,
    });
  } catch (err) {
    console.error("POST /api/users/:id/telegram-bind-code error", err);

    return res.status(500).json({
      message: "Ошибка генерации кода привязки",
    });
  }
});

export default router;