import { Router } from "express";
import { query } from "../../lib/db";
import {
  generateSalesReport,
  buildCsvWithSummary,
} from "./report.service";

const router = Router();

/**
 * GET /api/reports
 */
router.get("/", async (req, res) => {
  try {
    const reportsRes = await query<{
      id: number;
      name: string;
      description: string | null;
      periodType: "DAY" | "WEEK" | "MONTH";
    }>(
      `
      SELECT id, name, description, period_type as "periodType"
      FROM reports
      WHERE is_active = TRUE
      ORDER BY id ASC
      `
    );

    const reports = reportsRes.rows;

    res.json(reports);
  } catch (err) {
    console.error("GET /api/reports error", err);
    res.status(500).json({ message: "Ошибка получения отчётов" });
  }
});

/**
 * POST /api/reports/daily-sales
 * (для /today, можно использовать как «Ежедневный отчёт»)
 */
router.post("/daily-sales", async (req, res) => {
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

    res.json({
      period: {
        from: report.from,
        to: report.to,
      },
      summary: report.summary,
      csv: csvWithSummary,
    });
  } catch (err) {
    console.error("POST /api/reports/daily-sales error", err);
    res.status(500).json({ message: "Ошибка генерации отчёта" });
  }
});

/**
 * POST /api/reports/:id/run
 * (для /reports в боте)
 */
router.post("/:id/run", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ message: "Некорректный id отчёта" });
      return;
    }

    const reportRowRes = await query<{
      id: number;
      name: string;
      periodType: "DAY" | "WEEK" | "MONTH";
      isActive: boolean;
    }>(
      `
      SELECT id, name, period_type as "periodType", is_active as "isActive"
      FROM reports
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );

    const reportRow = reportRowRes.rows[0];

    if (!reportRow || !reportRow.isActive) {
      res.status(404).json({ message: "Отчёт не найден или отключён" });
      return;
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

    res.json({
      reportName: reportRow.name,
      summary: report.summary,
      csv: csvWithSummary,
    });
  } catch (err) {
    console.error(`POST /api/reports/${req.params.id}/run error`, err);
    res.status(500).json({ message: "Ошибка генерации отчёта по id" });
  }
});

export default router;
