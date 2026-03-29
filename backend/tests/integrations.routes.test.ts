/// <reference types="jest" />

import request from "supertest";
import jwt from "jsonwebtoken";

jest.mock("../src/lib/db", () => ({
  query: jest.fn(),
}));

import app from "../src/app";
import { query } from "../src/lib/db";

const queryMock = query as unknown as jest.Mock;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

function makeToken(payload: {
  id: number;
  username: string;
  role: "ADMIN" | "ANALYST" | "VIEWER";
}) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });
}

describe("Integrations routes", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  describe("GET /api/integrations/template", () => {
    test("200: шаблон доступен ADMIN", async () => {
      const token = makeToken({
        id: 1,
        username: "admin",
        role: "ADMIN",
      });

      queryMock.mockResolvedValueOnce({
        rows: [{ id: 1, username: "admin", role: "ADMIN", isActive: true }],
      });

      const res = await request(app)
        .get("/api/integrations/template")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.requiredColumns).toContain("sale_date");
      expect(res.body.acceptedFormats).toEqual(["csv", "xlsx"]);
    });
  });

  describe("POST /api/integrations/import", () => {
    test("400: файл не передан", async () => {
      const token = makeToken({
        id: 2,
        username: "analyst",
        role: "ANALYST",
      });

      queryMock.mockResolvedValueOnce({
        rows: [{ id: 2, username: "analyst", role: "ANALYST", isActive: true }],
      });

      const res = await request(app)
        .post("/api/integrations/import")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/файл/i);
    });

    test("400: неподдерживаемый формат файла", async () => {
      const token = makeToken({
        id: 2,
        username: "analyst",
        role: "ANALYST",
      });

      queryMock.mockResolvedValueOnce({
        rows: [{ id: 2, username: "analyst", role: "ANALYST", isActive: true }],
      });

      const res = await request(app)
        .post("/api/integrations/import")
        .set("Authorization", `Bearer ${token}`)
        .attach("file", Buffer.from("hello"), "test.txt");

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/csv|xlsx/i);
    });

    test("500: CSV с невалидной датой", async () => {
      const token = makeToken({
        id: 2,
        username: "analyst",
        role: "ANALYST",
      });

      queryMock
        .mockResolvedValueOnce({
          rows: [{ id: 2, username: "analyst", role: "ANALYST", isActive: true }],
        })
        .mockResolvedValueOnce({}); // rollback

      const csv = [
        "sale_date,product_name,customer_name,quantity,price",
        "2026-99-99,Ноутбук,ООО Альфа,2,65000",
      ].join("\n");

      const res = await request(app)
        .post("/api/integrations/import")
        .set("Authorization", `Bearer ${token}`)
        .attach("file", Buffer.from(csv, "utf8"), "sales.csv");

      expect(res.status).toBe(500);
      expect(res.body.message).toMatch(/sale_date/i);
    });

    test("200: успешный импорт CSV", async () => {
      const token = makeToken({
        id: 1,
        username: "admin",
        role: "ADMIN",
      });

      queryMock
        .mockResolvedValueOnce({
          rows: [{ id: 1, username: "admin", role: "ADMIN", isActive: true }],
        })
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // row 1 insert
        .mockResolvedValueOnce({}) // row 2 insert
        .mockResolvedValueOnce({}); // COMMIT

      const csv = [
        "sale_date,product_name,customer_name,quantity,price",
        "2026-03-01,Ноутбук,ООО Альфа,2,65000",
        "2026-03-02,Мышь,ООО Бета,1,1500",
      ].join("\n");

      const res = await request(app)
        .post("/api/integrations/import")
        .set("Authorization", `Bearer ${token}`)
        .attach("file", Buffer.from(csv, "utf8"), "sales.csv");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        message: "Импорт выполнен успешно",
        importedRows: 2,
        totalRevenue: 131500,
        filename: "sales.csv",
      });
    });
  });
});