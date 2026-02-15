/// <reference types="jest" />

import request from "supertest";

jest.mock("../src/lib/db", () => ({
  query: jest.fn(),
}));

import app from "../src/app";
import { query } from "../src/lib/db";

const queryMock = query as unknown as jest.Mock;

describe("POST /api/users/telegram-bind", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  test("400: если не переданы code/telegramId", async () => {
    const res = await request(app)
      .post("/api/users/telegram-bind")
      .send({});
    expect(res.status).toBe(400);
  });

  test("404: если code не найден", async () => {
    // 1) SELECT user by code
    queryMock.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post("/api/users/telegram-bind")
      .send({ code: "INVITE", telegramId: "123" });

    expect(res.status).toBe(404);
  });

  test("409: если telegramId уже привязан к другому пользователю", async () => {
    // 1) SELECT user by code
    queryMock.mockResolvedValueOnce({ rows: [{ id: 10, username: "INVITE" }] });
    // 2) SELECT by telegram_id
    queryMock.mockResolvedValueOnce({ rows: [{ id: 11, username: "other" }] });

    const res = await request(app)
      .post("/api/users/telegram-bind")
      .send({ code: "INVITE", telegramId: "123" });

    expect(res.status).toBe(409);
  });

  test("200: успешная привязка", async () => {
    // 1) SELECT user by code
    queryMock.mockResolvedValueOnce({ rows: [{ id: 10, username: "INVITE" }] });
    // 2) SELECT by telegram_id (нет конфликтов)
    queryMock.mockResolvedValueOnce({ rows: [] });
    // 3) UPDATE users SET telegram_id
    queryMock.mockResolvedValueOnce({
      rows: [{ id: 10, username: "INVITE", telegramId: "123" }],
    });

    const res = await request(app)
      .post("/api/users/telegram-bind")
      .send({ code: "INVITE", telegramId: "123" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 10, username: "INVITE", telegramId: "123" });
  });
});
