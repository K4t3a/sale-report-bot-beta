import express from "express";
import cors from "cors";
import crypto from "crypto";
import authRoutes from "./modules/auth/auth.routes";
import reportsRoutes from "./modules/reports/report.routes";
import usersRoutes from "./modules/users/user.routes";
import schedulesRoutes from "./modules/schedules/schedule.routes";
import logsRoutes from "./modules/logs/logs.routes";
import analyticsRoutes from "./modules/analytics/analytics.routes";
import telegramRoutes from "./modules/telegram/telegram.routes";
import integrationsRoutes from "./modules/integrations/integrations.routes";
import { query } from "./lib/db";

const app = express();

// RequestId помогает сопоставлять ошибки backend ↔ запросы.
app.use((req, res, next) => {
  const incoming = req.header("x-request-id")?.trim();
  const requestId =
    incoming && incoming.length <= 64 ? incoming : crypto.randomUUID();

  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
});

// Простой access log без внешних библиотек.
app.use((req, res, next) => {
  const startedAt = Date.now();

  res.on("finish", () => {
    const ms = Date.now() - startedAt;
    const rid = req.requestId;

    console.log(
      `[http] ${res.statusCode} ${req.method} ${req.originalUrl} ${ms}ms rid=${rid}`
    );
  });

  next();
});

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-request-id",
      "x-service-token",
    ],
  })
);

app.use(
  express.json({
    limit: "1mb",
  })
);

// Healthcheck остаётся публичным.
app.get("/api/health", async (req, res) => {
  const rid = req.requestId as string;

  try {
    await query("SELECT 1 as ok");

    res.json({
      status: "ok",
      db: "ok",
      requestId: rid,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[health] db ping failed", e);

    res.status(500).json({
      status: "error",
      db: "error",
      requestId: rid,
      timestamp: new Date().toISOString(),
    });
  }
});

// Публичные маршруты:
// - вход в web-панель
// - привязка Telegram по коду
// - проверка привязки Telegram
app.use("/api/auth", authRoutes);
app.use("/api/telegram", telegramRoutes);

// Внутри этих модулей уже встроена нужная схема доступа:
// JWT / service-token / роли.
app.use("/api/reports", reportsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/schedules", schedulesRoutes);
app.use("/api/logs", logsRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/integrations", integrationsRoutes);

// 404
app.use((req, res) => {
  const rid = req.requestId as string;

  res.status(404).json({
    message: "Маршрут не найден",
    requestId: rid,
  });
});

// Глобальный обработчик ошибок.
app.use((err: any, req: any, res: any, _next: any) => {
  const rid = req.requestId;

  console.error("[app] unhandled error", { rid, err });

  const status = typeof err?.status === "number" ? err.status : 500;

  res.status(status).json({
    message:
      status === 500
        ? "Внутренняя ошибка сервера"
        : String(err?.message ?? "Ошибка"),
    requestId: rid,
  });
});

export default app;