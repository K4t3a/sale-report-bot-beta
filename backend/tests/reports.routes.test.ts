/// <reference types="jest" />

import request from "supertest";
import jwt from "jsonwebtoken";

jest.mock("../src/lib/db", () => ({
  query: jest.fn(),
}));

jest.mock("../src/modules/reports/report.service", () => ({
  generateSalesReport: jest.fn(),
  buildCsvWithSummary: jest.fn(),
}));

import app from "../src/app";
import { query } from "../src/lib/db";
import {
  generateSalesReport,
  buildCsvWithSummary,
} from "../src/modules/reports/report.service";

const queryMock = query as unknown as jest.Mock;
const generateSalesReportMock = generateSalesReport as unknown as jest.Mock;
const buildCsvWithSummaryMock = buildCsvWithSummary as unknown as jest.Mock;

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const SERVICE_TOKEN = process.env.SERVICE_TOKEN || "dev-service-token";

function makeToken(payload: {
  id: number;
  username: string;
  role: "ADMIN" | "ANALYST" | "VIEWER";
}) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });
}

describe("Reports routes", () => {
  beforeEach(() => {
    queryMock.mockReset();
    generateSalesReportMock.mockReset();
    buildCsvWithSummaryMock.mockReset();
  });

  describe("GET /api/reports", () => {
    test("401: если не передан JWT и service-token", async () => {
      const res = await request(app).get("/api/reports");
      expect(res.status).toBe(401);
    });

    test("200: список отчётов по service-token", async () => {
      queryMock.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            name: "Ежедневный отчёт",
            description: "Продажи за день",
            periodType: "DAY",
          },
        ],
      });

      const res = await request(app)
        .get("/api/reports")
        .set("x-service-token", SERVICE_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([
        {
          id: 1,
          name: "Ежедневный отчёт",
          description: "Продажи за день",
          periodType: "DAY",
        },
      ]);
    });

    test("200: список отчётов по JWT", async () => {
      const token = makeToken({
        id: 1,
        username: "admin",
        role: "ADMIN",
      });

      queryMock
        .mockResolvedValueOnce({
          rows: [{ id: 1, username: "admin", role: "ADMIN", isActive: true }],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 2,
              name: "Недельный отчёт",
              description: "Продажи за неделю",
              periodType: "WEEK",
            },
          ],
        });

      const res = await request(app)
        .get("/api/reports")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body[0].id).toBe(2);
    });
  });

  describe("POST /api/reports/daily-sales", () => {
    test("403: VIEWER не может запускать отчёт", async () => {
      const token = makeToken({
        id: 3,
        username: "viewer",
        role: "VIEWER",
      });

      queryMock.mockResolvedValueOnce({
        rows: [{ id: 3, username: "viewer", role: "VIEWER", isActive: true }],
      });

      const res = await request(app)
        .post("/api/reports/daily-sales")
        .set("Authorization", `Bearer ${token}`)
        .send({ period: "today" });

      expect(res.status).toBe(403);
    });

    test("200: ANALYST может сформировать отчёт", async () => {
      const token = makeToken({
        id: 2,
        username: "analyst",
        role: "ANALYST",
      });

      queryMock.mockResolvedValueOnce({
        rows: [{ id: 2, username: "analyst", role: "ANALYST", isActive: true }],
      });

      generateSalesReportMock.mockResolvedValueOnce({
        from: "2026-03-20T00:00:00.000Z",
        to: "2026-03-26T23:59:59.999Z",
        summary: {
          totalRevenue: 120000,
          totalOrders: 50,
          totalQuantity: 87,
          averageCheck: 2400,
        },
        csv: "date,revenue\n2026-03-26,120000",
      });

      buildCsvWithSummaryMock.mockReturnValueOnce("csv-with-summary");

      const res = await request(app)
        .post("/api/reports/daily-sales")
        .set("Authorization", `Bearer ${token}`)
        .send({ period: "last7days" });

      expect(res.status).toBe(200);
      expect(generateSalesReportMock).toHaveBeenCalledWith("last7days");
      expect(res.body).toEqual({
        period: {
          from: "2026-03-20T00:00:00.000Z",
          to: "2026-03-26T23:59:59.999Z",
        },
        summary: {
          totalRevenue: 120000,
          totalOrders: 50,
          totalQuantity: 87,
          averageCheck: 2400,
        },
        csv: "csv-with-summary",
      });
    });

    test("200: неизвестный period заменяется на yesterday", async () => {
      generateSalesReportMock.mockResolvedValueOnce({
        from: "2026-03-27T00:00:00.000Z",
        to: "2026-03-27T23:59:59.999Z",
        summary: {
          totalRevenue: 5000,
          totalOrders: 3,
          totalQuantity: 4,
          averageCheck: 1666.67,
        },
        csv: "csv-data",
      });

      buildCsvWithSummaryMock.mockReturnValueOnce("csv-with-summary");

      const res = await request(app)
        .post("/api/reports/daily-sales")
        .set("x-service-token", SERVICE_TOKEN)
        .send({ period: "wrong-period" });

      expect(res.status).toBe(200);
      expect(generateSalesReportMock).toHaveBeenCalledWith("yesterday");
    });
  });

  describe("POST /api/reports/:id/run", () => {
    test("400: если id некорректный", async () => {
      const res = await request(app)
        .post("/api/reports/abc/run")
        .set("x-service-token", SERVICE_TOKEN);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/id/i);
    });

    test("404: если отчёт не найден", async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post("/api/reports/15/run")
        .set("x-service-token", SERVICE_TOKEN);

      expect(res.status).toBe(404);
    });

    test("200: MONTH -> last30days", async () => {
      queryMock.mockResolvedValueOnce({
        rows: [
          {
            id: 3,
            name: "Месячный отчёт",
            periodType: "MONTH",
            isActive: true,
          },
        ],
      });

      generateSalesReportMock.mockResolvedValueOnce({
        from: "2026-02-27T00:00:00.000Z",
        to: "2026-03-28T23:59:59.999Z",
        summary: {
          totalRevenue: 450000,
          totalOrders: 170,
          totalQuantity: 250,
          averageCheck: 2647.06,
        },
        csv: "csv-month",
      });

      buildCsvWithSummaryMock.mockReturnValueOnce("csv-with-month-summary");

      const res = await request(app)
        .post("/api/reports/3/run")
        .set("x-service-token", SERVICE_TOKEN);

      expect(res.status).toBe(200);
      expect(generateSalesReportMock).toHaveBeenCalledWith("last30days");
      expect(res.body.reportName).toBe("Месячный отчёт");
    });

    test("200: DAY -> today", async () => {
      queryMock.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            name: "Дневной отчёт",
            periodType: "DAY",
            isActive: true,
          },
        ],
      });

      generateSalesReportMock.mockResolvedValueOnce({
        from: "2026-03-28T00:00:00.000Z",
        to: "2026-03-28T23:59:59.999Z",
        summary: {
          totalRevenue: 10000,
          totalOrders: 5,
          totalQuantity: 8,
          averageCheck: 2000,
        },
        csv: "csv-day",
      });

      buildCsvWithSummaryMock.mockReturnValueOnce("csv-with-day-summary");

      const res = await request(app)
        .post("/api/reports/1/run")
        .set("x-service-token", SERVICE_TOKEN);

      expect(res.status).toBe(200);
      expect(generateSalesReportMock).toHaveBeenCalledWith("today");
    });
  });

  describe("POST /api/reports", () => {
    test("401: без авторизации нельзя", async () => {
      const res = await request(app).post("/api/reports").send({});
      expect(res.status).toBe(401);
    });

    test("403: ANALYST не может создавать шаблон", async () => {
      const token = makeToken({
        id: 2,
        username: "analyst",
        role: "ANALYST",
      });

      queryMock.mockResolvedValueOnce({
        rows: [{ id: 2, username: "analyst", role: "ANALYST", isActive: true }],
      });

      const res = await request(app)
        .post("/api/reports")
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(403);
    });

    test("501: ADMIN получает заглушку", async () => {
      const token = makeToken({
        id: 1,
        username: "admin",
        role: "ADMIN",
      });

      queryMock.mockResolvedValueOnce({
        rows: [{ id: 1, username: "admin", role: "ADMIN", isActive: true }],
      });

      const res = await request(app)
        .post("/api/reports")
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(501);
    });
  });
});