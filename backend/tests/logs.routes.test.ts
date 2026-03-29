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

describe("Logs routes", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  test("403: VIEWER не может читать логи", async () => {
    const token = makeToken({
      id: 3,
      username: "viewer",
      role: "VIEWER",
    });

    queryMock.mockResolvedValueOnce({
      rows: [{ id: 3, username: "viewer", role: "VIEWER", isActive: true }],
    });

    const res = await request(app)
      .get("/api/logs")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  test("200: ADMIN получает логи", async () => {
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
            id: 1,
            sentAt: "2026-03-29T10:00:00.000Z",
            status: "SUCCESS",
            error: null,
            reportId: 2,
            reportName: "Daily report",
            userId: 5,
            username: "viewer_1",
            scheduleId: 10,
          },
        ],
      });

    const res = await request(app)
      .get("/api/logs?limit=20")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body[0].status).toBe("SUCCESS");
  });

  test("200: limit по умолчанию подставляется", async () => {
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
        rows: [],
      });

    const res = await request(app)
      .get("/api/logs?limit=9999")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(queryMock).toHaveBeenLastCalledWith(expect.any(String), [50]);
  });
});