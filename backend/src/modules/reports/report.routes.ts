import { Router } from "express";
import { query } from "../../lib/db";
import {
  requireAuthOrService,
  requireAuth,
  requireRoles,
} from "../../middleware/auth";
import {
  generateSalesReport,
  buildCsvWithSummary,
} from "./report.service";

const router = Router();

/**
 * GET /api/reports
 * Список отчётов нужен и панели, и Telegram-боту.
 * Поэтому сюда допускаем JWT или service-token.
 */
router.get("/", requireAuthOrService, async (_req, res) => {
  try {
    const reportsRes = await query<{
      id: number;
      name: string;
      description: string | null;
      periodType: "DAY" | "WEEK" | "MONTH";
    }>(
      `
      SELECT
        id,
        name,
        description,
        period_type as "periodType"
      FROM reports
      WHERE is_active = TRUE
      ORDER BY id ASC
      `
    );

    return res.json(reportsRes.rows);
  } catch (err) {
    console.error("GET /api/reports error", err);

    return res.status(500).json({
      message: "Ошибка получения отчётов",
    });
  }
});

/**
 * POST /api/reports/daily-sales
 * Для панели допускаем ADMIN и ANALYST.
 * Для бота допускаем service-token.
 */
router.post(
  "/daily-sales",
  requireAuthOrService,
  async (req, res, next) => {
    if (req.user && !["ADMIN", "ANALYST"].includes(req.user.role)) {
      return res.status(403).json({
        message: "Недостаточно прав для выполнения операции",
      });
    }

    return next();
  },
  async (req, res) => {
    try {
      const { period } = req.body as { period?: string };

      const safePeriod =
        period === "today" || period === "last7days" || period === "last30days"
          ? period
          : "yesterday";

      const report = await generateSalesReport(safePeriod);

      const csvWithSummary = buildCsvWithSummary(
        "Ежедневный отчёт по продажам",
        report.summary,
        report.csv
      );

      return res.json({
        period: {
          from: report.from,
          to: report.to,
        },
        summary: report.summary,
        csv: csvWithSummary,
      });
    } catch (err) {
      console.error("POST /api/reports/daily-sales error", err);

      return res.status(500).json({
        message: "Ошибка генерации отчёта",
      });
    }
  }
);

/**
 * POST /api/reports/:id/run
 * Для панели допускаем ADMIN и ANALYST.
 * Для бота допускаем service-token.
 */
router.post(
  "/:id/run",
  requireAuthOrService,
  async (req, res, next) => {
    if (req.user && !["ADMIN", "ANALYST"].includes(req.user.role)) {
      return res.status(403).json({
        message: "Недостаточно прав для выполнения операции",
      });
    }

    return next();
  },
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (Number.isNaN(id)) {
        return res.status(400).json({
          message: "Некорректный id отчёта",
        });
      }

      const reportRowRes = await query<{
        id: number;
        name: string;
        periodType: "DAY" | "WEEK" | "MONTH";
        isActive: boolean;
      }>(
        `
        SELECT
          id,
          name,
          period_type as "periodType",
          is_active as "isActive"
        FROM reports
        WHERE id = $1
        LIMIT 1
        `,
        [id]
      );

      const reportRow = reportRowRes.rows[0];

      if (!reportRow || !reportRow.isActive) {
        return res.status(404).json({
          message: "Отчёт не найден или отключён",
        });
      }

      let periodKey: "today" | "yesterday" | "last7days" | "last30days";

      if (reportRow.periodType === "DAY") {
        periodKey = "today";
      } else if (reportRow.periodType === "WEEK") {
        periodKey = "last7days";
      } else if (reportRow.periodType === "MONTH") {
        periodKey = "last30days";
      } else {
        periodKey = "today";
      }

      const report = await generateSalesReport(periodKey);

      const csvWithSummary = buildCsvWithSummary(
        reportRow.name,
        report.summary,
        report.csv
      );

      return res.json({
        reportName: reportRow.name,
        summary: report.summary,
        csv: csvWithSummary,
      });
    } catch (err) {
      console.error(`POST /api/reports/${req.params.id}/run error`, err);

      return res.status(500).json({
        message: "Ошибка генерации отчёта по id",
      });
    }
  }
);

/**
 * Пример задела под будущее CRUD шаблонов отчётов.
 * Сейчас это сразу закрыто только для ADMIN.
 */
router.post(
  "/",
  requireAuth,
  requireRoles("ADMIN"),
  async (_req, res) => {
    return res.status(501).json({
      message: "Создание шаблонов отчётов пока не реализовано",
    });
  }
);

export default router;