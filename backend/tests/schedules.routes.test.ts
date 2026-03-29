/// <reference types="jest" />

import request from "supertest";
import jwt from "jsonwebtoken";

jest.mock("../src/lib/db", () => ({
  query: jest.fn(),
}));

jest.mock("../src/modules/schedules/schedule.service", () => ({
  findAndPrepareDueSchedules: jest.fn(),
}));

import app from "../src/app";
import { query } from "../src/lib/db";
import { findAndPrepareDueSchedules } from "../src/modules/schedules/schedule.service";

const queryMock = query as unknown as jest.Mock;
const findAndPrepareDueSchedulesMock =
  findAndPrepareDueSchedules as unknown as jest.Mock;

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const SERVICE_TOKEN = process.env.SERVICE_TOKEN || "dev-service-token";

function makeToken(payload: {
  id: number;
  username: string;
  role: "ADMIN" | "ANALYST" | "VIEWER";
}) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });
}

describe("Schedules routes", () => {
  beforeEach(() => {
    queryMock.mockReset();
    findAndPrepareDueSchedulesMock.mockReset();
  });

  describe("POST /api/schedules/run-due", () => {
    test("401: без service-token нельзя", async () => {
      const res = await request(app).post("/api/schedules/run-due");
      expect(res.status).toBe(401);
    });

    test("200: bot может получить готовые задачи", async () => {
      findAndPrepareDueSchedulesMock.mockResolvedValueOnce([
        { scheduleId: 1, reportId: 2, recipients: [] },
      ]);

      const res = await request(app)
        .post("/api/schedules/run-due")
        .set("x-service-token", SERVICE_TOKEN);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe("GET /api/schedules", () => {
    test("200: ANALYST получает расписания", async () => {
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
              scheduleId: 1,
              hour: 10,
              minute: 30,
              frequency: "DAILY",
              weekday: null,
              isActive: true,
              reportId: 1,
              reportName: "Daily report",
              userId: 5,
              username: "viewer_1",
              telegramId: "777",
            },
          ],
        });

      const res = await request(app)
        .get("/api/schedules")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body[0]).toEqual({
        id: 1,
        hour: 10,
        minute: 30,
        frequency: "DAILY",
        weekday: null,
        isActive: true,
        report: { id: 1, name: "Daily report" },
        recipients: [{ id: 5, username: "viewer_1", telegramId: "777" }],
      });
    });
  });

  describe("POST /api/schedules", () => {
    test("400: обязательные поля не переданы", async () => {
      const token = makeToken({
        id: 1,
        username: "admin",
        role: "ADMIN",
      });

      queryMock.mockResolvedValueOnce({
        rows: [{ id: 1, username: "admin", role: "ADMIN", isActive: true }],
      });

      const res = await request(app)
        .post("/api/schedules")
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
    });

    test("400: WEEKLY без weekday", async () => {
      const token = makeToken({
        id: 1,
        username: "admin",
        role: "ADMIN",
      });

      queryMock.mockResolvedValueOnce({
        rows: [{ id: 1, username: "admin", role: "ADMIN", isActive: true }],
      });

      const res = await request(app)
        .post("/api/schedules")
        .set("Authorization", `Bearer ${token}`)
        .send({
          reportId: 1,
          hour: 10,
          minute: 30,
          frequency: "WEEKLY",
          recipientIds: [5],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/weekday/i);
    });

    test("201: DAILY создаётся успешно", async () => {
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
              id: 10,
              hour: 9,
              minute: 0,
              frequency: "DAILY",
              weekday: null,
              isActive: true,
            },
          ],
        })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({
          rows: [
            {
              scheduleId: 10,
              hour: 9,
              minute: 0,
              frequency: "DAILY",
              weekday: null,
              isActive: true,
              reportId: 1,
              reportName: "Daily report",
              userId: 5,
              username: "viewer_1",
              telegramId: "777",
            },
          ],
        });

      const res = await request(app)
        .post("/api/schedules")
        .set("Authorization", `Bearer ${token}`)
        .send({
          reportId: 1,
          hour: 9,
          minute: 0,
          frequency: "DAILY",
          recipientIds: [5],
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe(10);
      expect(res.body.recipients.length).toBe(1);
    });
  });

  describe("DELETE /api/schedules/:id", () => {
    test("400: id некорректный", async () => {
      const token = makeToken({
        id: 1,
        username: "admin",
        role: "ADMIN",
      });

      queryMock.mockResolvedValueOnce({
        rows: [{ id: 1, username: "admin", role: "ADMIN", isActive: true }],
      });

      const res = await request(app)
        .delete("/api/schedules/abc")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
    });

    test("204: расписание удалено", async () => {
      const token = makeToken({
        id: 1,
        username: "admin",
        role: "ADMIN",
      });

      queryMock
        .mockResolvedValueOnce({
          rows: [{ id: 1, username: "admin", role: "ADMIN", isActive: true }],
        })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const res = await request(app)
        .delete("/api/schedules/10")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(204);
    });
  });
});