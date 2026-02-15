import express from "express";
import cors from "cors";
import crypto from "crypto";
import authRoutes from "./modules/auth/auth.routes";
import reportsRoutes from "./modules/reports/report.routes";
import usersRoutes from "./modules/users/user.routes";
import schedulesRoutes from "./modules/schedules/schedule.routes";
import logsRoutes from "./modules/logs/logs.routes";
import analyticsRoutes from "./modules/analytics/analytics.routes";
import { query } from "./lib/db";

const app = express();

// --- базовые middleware ---

// RequestId помогает быстро сопоставлять ошибки backend ↔ запросы (особенно на защите).
app.use((req, res, next) => {
  const incoming = req.header("x-request-id")?.trim();
  const requestId = incoming && incoming.length <= 64 ? incoming : crypto.randomUUID();

  // @ts-expect-error — добавляем поле для удобства логирования
  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
});

// Лёгкий access log (без внешних библиотек)
app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - startedAt;
    // @ts-expect-error — поле добавили выше
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
    allowedHeaders: ["Content-Type", "Authorization", "x-request-id"],
  })
);

app.use(
  express.json({
    limit: "1mb",
  })
);

// Healthcheck лучше делать чуть богаче: можно показать преподавателю, что API и БД живы.
app.get("/api/health", async (req, res) => {
  // @ts-expect-error — поле добавили middleware выше
  const rid = req.requestId as string;

  try {
    // Быстрый ping БД
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

app.use("/api/auth", authRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/schedules", schedulesRoutes);
app.use("/api/logs", logsRoutes);
app.use("/api/analytics", analyticsRoutes);

// 404
app.use((req, res) => {
  // @ts-expect-error — поле добавили middleware выше
  const rid = req.requestId as string;
  res.status(404).json({
    message: "Маршрут не найден",
    requestId: rid,
  });
});

// Глобальный обработчик ошибок (чтобы не протекали stack trace наружу)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, req: any, res: any, _next: any) => {
  const rid = req.requestId;
  console.error("[app] unhandled error", { rid, err });

  const status = typeof err?.status === "number" ? err.status : 500;
  res.status(status).json({
    message: status === 500 ? "Внутренняя ошибка сервера" : String(err?.message ?? "Ошибка"),
    requestId: rid,
  });
});

export default app;
