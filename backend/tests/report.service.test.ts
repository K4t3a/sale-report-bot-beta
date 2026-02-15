/// <reference types="jest" />

import {
  getDateRangeForPeriod,
  buildSummaryFromRows,
} from "../src/modules/reports/report.service";

describe("getDateRangeForPeriod", () => {
  test("today: from и to в один день", () => {
    const { from, to } = getDateRangeForPeriod("today");

    expect(from.toDateString()).toBe(to.toDateString());
    expect(from.getTime()).toBeLessThanOrEqual(to.getTime());
  });

  test("yesterday: from и to вчера", () => {
    const now = new Date();
    const yesterday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 1
    );

    const { from, to } = getDateRangeForPeriod("yesterday", now);

    expect(from.toDateString()).toBe(yesterday.toDateString());
    expect(to.toDateString()).toBe(yesterday.toDateString());
    expect(from.getTime()).toBeLessThanOrEqual(to.getTime());
  });

  test("last7days: диапазон примерно 7 дней", () => {
    const now = new Date(2025, 0, 15); 
    const { from, to } = getDateRangeForPeriod("last7days", now);

    const diffMs = to.getTime() - from.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    
    expect(diffDays).toBeGreaterThanOrEqual(6);
    expect(diffDays).toBeLessThanOrEqual(7.5);

    
    expect(from.getTime()).toBeLessThanOrEqual(to.getTime());
  });
});

describe("buildSummaryFromRows", () => {
  test("корректно считает выручку и средний чек", () => {
    const rows = [
      { price: 1000, quantity: 2 }, 
      { price: 500, quantity: 1 },  
      { price: 200, quantity: 3 },  
    ];

    const summary = buildSummaryFromRows(rows);

    expect(summary.totalRevenue).toBe(3100);
    expect(summary.totalOrders).toBe(3);
    expect(summary.totalQuantity).toBe(6);
    expect(summary.averageCheck).toBeCloseTo(1033.33, 2);
  });

  test("пустой массив даёт нули без NaN", () => {
    const summary = buildSummaryFromRows([]);

    expect(summary.totalRevenue).toBe(0);
    expect(summary.totalOrders).toBe(0);
    expect(summary.totalQuantity).toBe(0);
    expect(summary.averageCheck).toBe(0);
  });
});
