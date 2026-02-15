/// <reference types="jest" />

// Тестируем именно сервис (без поднятия Express), поэтому мокаем db и генератор отчётов.
jest.mock("../src/lib/db", () => ({
  query: jest.fn(),
}));

jest.mock("../src/modules/reports/report.service", () => ({
  // generateSalesReport вызывается внутри schedule.service
  generateSalesReport: jest.fn(),
  buildCsvWithSummary: jest.fn((name: string, _summary: any, csv: string) => {
    return `SUMMARY:${name}\n\n${csv}`;
  }),
}));

import { query } from "../src/lib/db";
import { generateSalesReport } from "../src/modules/reports/report.service";
import { findAndPrepareDueSchedules } from "../src/modules/schedules/schedule.service";

const queryMock = query as unknown as jest.Mock;
const generateSalesReportMock = generateSalesReport as unknown as jest.Mock;

describe("findAndPrepareDueSchedules", () => {
  beforeEach(() => {
    queryMock.mockReset();
    generateSalesReportMock.mockReset();
  });

  test("возвращает [] если нет расписаний на текущие hour/minute", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });

    const res = await findAndPrepareDueSchedules();
    expect(res).toEqual([]);
  });

  test("группирует получателей по scheduleId и формирует отчёт", async () => {
    // 1) выборка schedules × recipients
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          scheduleId: 1,
          reportId: 101,
          reportName: "Daily",
          periodType: "DAY",
          frequency: "DAILY",
          weekday: null,
          userId: 1,
          telegramId: "111",
          isUserActive: true,
        },
        {
          scheduleId: 1,
          reportId: 101,
          reportName: "Daily",
          periodType: "DAY",
          frequency: "DAILY",
          weekday: null,
          userId: 2,
          telegramId: "222",
          isUserActive: true,
        },
      ],
    });

    // 2) alreadySent check
    queryMock.mockResolvedValueOnce({ rows: [] });

    generateSalesReportMock.mockResolvedValueOnce({
      from: new Date().toISOString(),
      to: new Date().toISOString(),
      summary: { totalRevenue: 10, totalOrders: 1, totalQuantity: 1, averageCheck: 10 },
      csv: "date;customer;product;quantity;price;sum\n2025-01-01;A;B;1;10;10",
    });

    // 3) insert delivery logs
    queryMock.mockResolvedValueOnce({ rows: [] });

    const res = await findAndPrepareDueSchedules();

    expect(res).toHaveLength(1);
    expect(res[0].scheduleId).toBe(1);
    expect(res[0].recipients).toHaveLength(2);
    expect(res[0].csv).toMatch(/^SUMMARY:Daily/);
    expect(generateSalesReportMock).toHaveBeenCalledTimes(1);
  });

  test("не формирует задачу, если уже есть SUCCESS в текущей минуте", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          scheduleId: 1,
          reportId: 101,
          reportName: "Daily",
          periodType: "DAY",
          frequency: "DAILY",
          weekday: null,
          userId: 1,
          telegramId: "111",
          isUserActive: true,
        },
      ],
    });

    // alreadySent check -> нашли запись
    queryMock.mockResolvedValueOnce({ rows: [{ id: 999 }] });

    const res = await findAndPrepareDueSchedules();
    expect(res).toEqual([]);
    expect(generateSalesReportMock).not.toHaveBeenCalled();
  });
});
