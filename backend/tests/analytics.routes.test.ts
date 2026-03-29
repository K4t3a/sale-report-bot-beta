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

describe("Analytics routes", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  test("403: VIEWER не может получать аналитику", async () => {
    const token = makeToken({
      id: 3,
      username: "viewer",
      role: "VIEWER",
    });

    queryMock.mockResolvedValueOnce({
      rows: [{ id: 3, username: "viewer", role: "VIEWER", isActive: true }],
    });

    const res = await request(app)
      .get("/api/analytics/sales-by-day")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  test("200: ANALYST получает серию по дням", async () => {
    const token = makeToken({
      id: 2,
      username: "analyst",
      role: "ANALYST",
    });

    queryMock
      .mockResolvedValueOnce({
        rows: [{ id: 2, username: "analyst", role: "ANALYST", isActive: true }],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            day: "2026-03-28",
            totalRevenue: "120000",
            totalOrders: "5",
            totalQuantity: "10",
          },
        ],
      });

    const res = await request(app)
      .get("/api/analytics/sales-by-day?days=7")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.days).toBe(7);
    expect(Array.isArray(res.body.points)).toBe(true);
    expect(res.body.points.length).toBe(7);
  });

  test("200: некорректный days заменяется на 7", async () => {
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
        rows: [],
      });

    const res = await request(app)
      .get("/api/analytics/sales-by-day?days=999")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.days).toBe(7);
  });
});