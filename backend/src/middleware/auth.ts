import type { NextFunction, Request, Response } from "express";
import jwt, { TokenExpiredError } from "jsonwebtoken";
import { query } from "../lib/db";

export type UserRole = "ADMIN" | "ANALYST" | "VIEWER";

export interface JwtPayload {
  id: number;
  username: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const SERVICE_TOKEN = process.env.SERVICE_TOKEN || "dev-service-token";

// Достаём Bearer-токен из заголовка Authorization.
// Для панели используем только один понятный формат: Bearer <token>.
function getBearerToken(req: Request): string | null {
  const header = req.header("authorization") ?? req.header("Authorization");

  if (!header) {
    return null;
  }

  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token.trim();
}

// Отдельный служебный токен нужен для bot -> backend.
// Так внутренние маршруты не остаются полностью публичными.
function getServiceToken(req: Request): string | null {
  const token =
    req.header("x-service-token") ??
    req.header("X-Service-Token") ??
    null;

  return token?.trim() || null;
}

// Общая проверка JWT.
// После валидации токена дополнительно проверяем пользователя в БД.
async function verifyJwtAndAttachUser(req: Request) {
  const token = getBearerToken(req);

  if (!token) {
    return {
      ok: false as const,
      status: 401,
      message: "Требуется авторизация",
    };
  }

  const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

  if (!decoded?.id || !decoded?.username || !decoded?.role) {
    return {
      ok: false as const,
      status: 401,
      message: "Некорректный токен",
    };
  }

  const userRes = await query<{
    id: number;
    username: string;
    role: UserRole;
    isActive: boolean;
  }>(
    `
    SELECT
      id,
      username,
      role,
      is_active as "isActive"
    FROM users
    WHERE id = $1
    LIMIT 1
    `,
    [decoded.id]
  );

  const user = userRes.rows[0];

  if (!user || !user.isActive) {
    return {
      ok: false as const,
      status: 401,
      message: "Пользователь не найден или деактивирован",
    };
  }

  req.user = {
    id: user.id,
    username: user.username,
    role: user.role,
  };

  return { ok: true as const };
}

// Базовая авторизация для web-панели.
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await verifyJwtAndAttachUser(req);

    if (!result.ok) {
      return res.status(result.status).json({
        message: result.message,
      });
    }

    return next();
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      return res.status(401).json({
        message: "Сессия истекла, войдите снова",
      });
    }

    if (err instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        message: "Недействительный токен",
      });
    }

    return next(err);
  }
}

// Проверка ролей поверх уже подтверждённой авторизации.
export function requireRoles(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Требуется авторизация",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Недостаточно прав для выполнения операции",
      });
    }

    return next();
  };
}

// Авторизация для внутренних сервисных вызовов.
// Используем на маршрутах, которые вызывает только бот.
export function requireServiceAuth(req: Request, res: Response, next: NextFunction) {
  const token = getServiceToken(req);

  if (!token || token !== SERVICE_TOKEN) {
    return res.status(401).json({
      message: "Недействительный сервисный токен",
    });
  }

  return next();
}

// Иногда один маршрут должен работать и для панели, и для бота.
// Например, список отчётов и запуск отчёта.
export async function requireAuthOrService(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const serviceToken = getServiceToken(req);

    if (serviceToken && serviceToken === SERVICE_TOKEN) {
      return next();
    }

    const result = await verifyJwtAndAttachUser(req);

    if (!result.ok) {
      return res.status(result.status).json({
        message: result.message,
      });
    }

    return next();
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      return res.status(401).json({
        message: "Сессия истекла, войдите снова",
      });
    }

    if (err instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        message: "Недействительный токен",
      });
    }

    return next(err);
  }
}