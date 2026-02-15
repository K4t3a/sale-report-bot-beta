import { Router } from "express";
import { query } from "../../lib/db";

const router = Router();


function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * GET /api/analytics/sales-by-day?days=7
 *
 * Возвращает серию по дням:
 * [
 *   { date: "2025-12-01", totalRevenue: 32000, totalOrders: 3, totalQuantity: 7 },
 *   ...
 * ]
 */
router.get("/sales-by-day", async (req, res) => {
  try {
    const daysParam = Number(req.query.days ?? 7);
    const days =
      Number.isFinite(daysParam) && daysParam > 0 && daysParam <= 90
        ? Math.floor(daysParam)
        : 7;

    const now = new Date();
    const from = startOfDay(addDays(now, -(days - 1)));
    const to = endOfDay(now);

    // Аггрегация SQL-ем: это быстрее и проще для больших объёмов данных.
    const aggRes = await query<{
      day: string;
      totalRevenue: string;
      totalOrders: string;
      totalQuantity: string;
    }>(
      `
      SELECT
        to_char(date_trunc('day', sale_date), 'YYYY-MM-DD') as day,
        COALESCE(SUM(price * quantity), 0) as "totalRevenue",
        COUNT(*) as "totalOrders",
        COALESCE(SUM(quantity), 0) as "totalQuantity"
      FROM sale_demo
      WHERE sale_date >= $1 AND sale_date <= $2
      GROUP BY day
      ORDER BY day ASC
      `,
      [from, to]
    );

    const byDate = new Map<string, {
      totalRevenue: number;
      totalOrders: number;
      totalQuantity: number;
    }>();

    for (const r of aggRes.rows) {
      byDate.set(r.day, {
        totalRevenue: Number(r.totalRevenue),
        totalOrders: Number(r.totalOrders),
        totalQuantity: Number(r.totalQuantity),
      });
    }

    
    const points: {
      date: string;
      totalRevenue: number;
      totalOrders: number;
      totalQuantity: number;
    }[] = [];

    for (let i = 0; i < days; i++) {
      const d = addDays(from, i);
      const key = d.toISOString().slice(0, 10);
      const agg = byDate.get(key);

      points.push({
        date: key,
        totalRevenue: agg?.totalRevenue ?? 0,
        totalOrders: agg?.totalOrders ?? 0,
        totalQuantity: agg?.totalQuantity ?? 0,
      });
    }

    res.json({
      from: from.toISOString(),
      to: to.toISOString(),
      days,
      points,
    });
  } catch (err) {
    console.error("GET /api/analytics/sales-by-day error", err);
    res.status(500).json({ message: "Ошибка аналитики продаж" });
  }
});

export default router;
