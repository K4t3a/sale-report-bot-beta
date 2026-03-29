import { query } from "../../lib/db";

// Ключи периодов для формирования отчёта.
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
 * Экранирует значение для CSV.
 * Если в тексте есть запятая, кавычка или перевод строки — оборачиваем в кавычки.
 */
function escapeCsvCell(value: string | number): string {
  const stringValue = String(value);

  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n") ||
    stringValue.includes("\r")
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Преобразует ключ периода в диапазон дат [from..to].
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
 * - читает записи из sale_demo
 * - считает сводные показатели
 * - строит CSV с детализацией
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
    price: string;
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

  const sales = salesRes.rows.map((sale) => ({
    ...sale,
    price: Number(sale.price),
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

  const rows: Row[] = sales.map((sale) => {
    const sum = sale.price * sale.quantity;
    totalRevenue += sum;
    totalQuantity += sale.quantity;

    return {
      date: sale.saleDate.toISOString().slice(0, 10),
      customer: sale.customer,
      product: sale.product,
      quantity: sale.quantity,
      price: Number(sale.price.toFixed(2)),
      sum: Number(sum.toFixed(2)),
    };
  });

  const averageCheck =
    totalOrders > 0 ? Number((totalRevenue / totalOrders).toFixed(2)) : 0;

  const header = ["date", "customer", "product", "quantity", "price", "sum"]
    .map(escapeCsvCell)
    .join(",");

  const lines = rows.map((row) =>
    [
      escapeCsvCell(row.date),
      escapeCsvCell(row.customer),
      escapeCsvCell(row.product),
      escapeCsvCell(row.quantity),
      escapeCsvCell(row.price.toFixed(2)),
      escapeCsvCell(row.sum.toFixed(2)),
    ].join(",")
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
 * Сначала мини-блок summary, потом пустая строка, потом таблица.
 */
export function buildCsvWithSummary(
  reportName: string,
  summary: SalesReportSummary,
  detailCsv: string
): string {
  const summaryLines = [
    ["report_name", reportName],
    ["total_revenue", summary.totalRevenue.toFixed(2)],
    ["total_orders", String(summary.totalOrders)],
    ["total_quantity", String(summary.totalQuantity)],
    ["average_check", summary.averageCheck.toFixed(2)],
    [],
  ].map((row) => row.map(escapeCsvCell).join(","));

  return `${summaryLines.join("\n")}\n${detailCsv}`;
}

export type SaleRow = {
  price: number;
  quantity: number;
};

export function buildSummaryFromRows(rows: SaleRow[]) {
  const totalRevenue = rows.reduce((sum, row) => sum + row.price * row.quantity, 0);

  const totalOrders = rows.length;

  const totalQuantity = rows.reduce((sum, row) => sum + row.quantity, 0);

  const averageCheck = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  return {
    totalRevenue,
    totalOrders,
    totalQuantity,
    averageCheck,
  };
}