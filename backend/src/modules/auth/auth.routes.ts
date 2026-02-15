
import { Router } from "express";
import { query } from "../../lib/db";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body as {
      username?: string;
      password?: string;
    };

    if (!username || !password) {
      return res
        .status(400)
        .json({ message: "Укажите логин и пароль" });
    }

    const userRes = await query<{
      id: number;
      username: string;
      role: "ADMIN" | "VIEWER";
      isActive: boolean;
      passwordHash: string | null;
    }>(
      `
      SELECT
        id,
        username,
        role,
        is_active as "isActive",
        password_hash as "passwordHash"
      FROM users
      WHERE username = $1
      LIMIT 1
      `,
      [username]
    );

    const user = userRes.rows[0];

    if (!user || !user.isActive || user.role !== "ADMIN") {
      return res
        .status(401)
        .json({ message: "Неверный логин или пароль" });
    }

    // В бете используем bcrypt-хеши (создаются seed-скриптом)
    const isValid =
      typeof user.passwordHash === "string" &&
      (await bcrypt.compare(password, user.passwordHash));

    if (!isValid) {
      return res
        .status(401)
        .json({ message: "Неверный логин или пароль" });
    }

    const payload = {
      id: user.id,
      username: user.username,
      role: user.role,
    };

    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: "8h",
    });

    res.json({
      token,
      user: payload,
    });
  } catch (err) {
    console.error("POST /api/auth/login error", err);
    res.status(500).json({ message: "Ошибка авторизации" });
  }
});

export default router;
