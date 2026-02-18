import { query } from "../../lib/db";

// Ключи периодов для формирования отчёта.
// last30days, чтобы корректно поддерживать отчёты с типом MONTH.
export type ReportPeriodKey = "today" | "yesterday" | "last7days" | "last30days";

export interface SalesReportSummary {
  totalRevenue: number;
  totalOrders: number;
  totalQuantity: number;
  averageCheck: number;
}

export interface SalesReportResult {
  from: string;
  to: string;
  summary: SalesReportSummary;
  csv: string;
}

/**
 * Возвращает начало дня (00:00:00.000) для указанной даты.
 */

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Возвращает конец дня (23:59:59.999) для указанной даты.
 */

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Добавляет N дней к дате.
 */

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Преобразует ключ периода (today / yesterday / last7days) в диапазон дат [from..to].
 */
export function getDateRangeForPeriod(
  period: ReportPeriodKey,
  now: Date = new Date()
): { from: Date; to: Date } {
  let from: Date;
  let to: Date;

  switch (period) {
    case "today": {
      from = startOfDay(now);
      to = endOfDay(now);
      break;
    }
    case "yesterday": {
      const y = addDays(now, -1);
      from = startOfDay(y);
      to = endOfDay(y);
      break;
    }
    case "last7days": {
      const fromRaw = addDays(now, -6);
      from = startOfDay(fromRaw);
      to = endOfDay(now);
      break;
    }
    case "last30days": {
      const fromRaw = addDays(now, -29);
      from = startOfDay(fromRaw);
      to = endOfDay(now);
      break;
    }
    default: {
      from = startOfDay(now);
      to = endOfDay(now);
    }
  }

  return { from, to };
}

/**
 * Формирует отчёт по продажам за заданный период:
 * - читает записи из таблицы sale_demo
 * - считает сводные показатели
 * - строит CSV с детализацией
 *
 * @param period ключ периода
 */
export async function generateSalesReport(
  period: ReportPeriodKey
): Promise<SalesReportResult> {
  const now = new Date();
  const { from, to } = getDateRangeForPeriod(period, now);

  const salesRes = await query<{
    customer: string;
    product: string;
    quantity: number;
    price: string; // NUMERIC приходит строкой
    saleDate: Date;
  }>(
    `
    SELECT
      customer,
      product,
      quantity,
      price,
      sale_date as "saleDate"
    FROM sale_demo
    WHERE sale_date >= $1 AND sale_date <= $2
    ORDER BY sale_date ASC
    `,
    [from, to]
  );

  const sales = salesRes.rows.map((s) => ({
    ...s,
    price: Number(s.price),
  }));

  let totalRevenue = 0;
  const totalOrders = sales.length;
  let totalQuantity = 0;

  type Row = {
    date: string;
    customer: string;
    product: string;
    quantity: number;
    price: number;
    sum: number;
  };

  const rows: Row[] = sales.map((s) => {
    const sum = s.price * s.quantity;
    totalRevenue += sum;
    totalQuantity += s.quantity;

    const dateStr = s.saleDate.toISOString().slice(0, 10);

    return {
      date: dateStr,
      customer: s.customer,
      product: s.product,
      quantity: s.quantity,
      price: s.price,
      sum,
    };
  });

  const averageCheck =
    totalOrders > 0 ? Number((totalRevenue / totalOrders).toFixed(2)) : 0;

  const header = "date;customer;product;quantity;price;sum";
  const lines = rows.map(
    (r) =>
      `${r.date};${r.customer};${r.product};${r.quantity};${r.price
        .toFixed(2)
        .replace(".", ",")};${r.sum.toFixed(2).replace(".", ",")}`
  );

  const csvTable = [header, ...lines].join("\n");

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    summary: {
      totalRevenue: Number(totalRevenue.toFixed(2)),
      totalOrders,
      totalQuantity,
      averageCheck,
    },
    csv: csvTable,
  };
}

/**
 * Объединяет краткую сводку и детализацию CSV в один файл.
 */
export function buildCsvWithSummary(
  reportName: string,
  summary: SalesReportSummary,
  detailCsv: string
): string {
  // Блок summary нужен для удобства чтения отчёта в Excel/Google Sheets.
  const summaryLines = [
    `Отчёт;${reportName}`,
    `Выручка;${summary.totalRevenue.toFixed(2)}`,
    `Количество заказов;${summary.totalOrders}`,
    `Количество единиц;${summary.totalQuantity}`,
    `Средний чек;${summary.averageCheck.toFixed(2)}`,
    "",
  ];

  return summaryLines.join("\n") + "\n" + detailCsv;
}

export type SaleRow = {
  price: number;
  quantity: number;
};

export function buildSummaryFromRows(rows: SaleRow[]) {
  const totalRevenue = rows.reduce(
    (sum, row) => sum + row.price * row.quantity,
    0
  );

  const totalOrders = rows.length;

  const totalQuantity = rows.reduce(
    (sum, row) => sum + row.quantity,
    0
  );

  const averageCheck =
    totalOrders > 0 ? totalRevenue / totalOrders : 0;

  return {
    totalRevenue,
    totalOrders,
    totalQuantity,
    averageCheck,
  };
}
