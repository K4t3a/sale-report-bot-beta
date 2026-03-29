/// <reference types="jest" />

import request from "supertest";

jest.mock("../src/lib/db", () => ({
  query: jest.fn(),
}));

jest.mock("../src/modules/users/user.service", () => ({
  bindTelegramAccountByCode: jest.fn(),
}));

import app from "../src/app";
import { query } from "../src/lib/db";
import { bindTelegramAccountByCode } from "../src/modules/users/user.service";

const queryMock = query as unknown as jest.Mock;
const bindTelegramAccountByCodeMock =
  bindTelegramAccountByCode as unknown as jest.Mock;

describe("Telegram routes", () => {
  beforeEach(() => {
    queryMock.mockReset();
    bindTelegramAccountByCodeMock.mockReset();
  });

  describe("POST /api/telegram/bind", () => {
    test("400: если не переданы code и telegramId", async () => {
      const res = await request(app).post("/api/telegram/bind").send({});
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/код|telegram id/i);
    });

    test("400: если код недействителен", async () => {
      bindTelegramAccountByCodeMock.mockResolvedValueOnce(null);

      const res = await request(app).post("/api/telegram/bind").send({
        code: "abc123",
        telegramId: "777",
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/недействителен|истёк|использован/i);
      expect(bindTelegramAccountByCodeMock).toHaveBeenCalledWith({
        code: "ABC123",
        telegramId: "777",
        telegramUsername: null,
        telegramFirstName: null,
        telegramLastName: null,
      });
    });

    test("409: если telegram уже привязан к другому пользователю", async () => {
      bindTelegramAccountByCodeMock.mockRejectedValueOnce({ code: "23505" });

      const res = await request(app).post("/api/telegram/bind").send({
        code: "abc123",
        telegramId: "777",
      });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/уже привязан/i);
    });

    test("200: успешная привязка", async () => {
      bindTelegramAccountByCodeMock.mockResolvedValueOnce({
        id: 10,
        username: "analyst",
        role: "ANALYST",
      });

      const res = await request(app).post("/api/telegram/bind").send({
        code: "abc123",
        telegramId: "777",
        telegramUsername: "tg_user",
        telegramFirstName: "Ivan",
        telegramLastName: "Petrov",
      });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        message: "Telegram успешно привязан",
        user: {
          id: 10,
          username: "analyst",
          role: "ANALYST",
        },
      });

      expect(bindTelegramAccountByCodeMock).toHaveBeenCalledWith({
        code: "ABC123",
        telegramId: "777",
        telegramUsername: "tg_user",
        telegramFirstName: "Ivan",
        telegramLastName: "Petrov",
      });
    });
  });

  describe("GET /api/telegram/me/:telegramId", () => {
    test("404: если пользователь не привязан", async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get("/api/telegram/me/777");

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/не привязан/i);
    });

    test("200: если привязка найдена", async () => {
      queryMock.mockResolvedValueOnce({
        rows: [
          {
            id: 5,
            username: "viewer_1",
            role: "VIEWER",
            isActive: true,
            telegramId: "777",
          },
        ],
      });

      const res = await request(app).get("/api/telegram/me/777");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        user: {
          id: 5,
          username: "viewer_1",
          role: "VIEWER",
          isActive: true,
          telegramId: "777",
        },
      });
    });
  });

  describe("POST /api/telegram/unbind", () => {
    test("400: если не передан telegramId", async () => {
      const res = await request(app).post("/api/telegram/unbind").send({});
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/telegram id/i);
    });

    test("404: если аккаунт не был привязан", async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).post("/api/telegram/unbind").send({
        telegramId: "777",
      });

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/не был привязан/i);
    });

    test("200: успешная отвязка", async () => {
      queryMock.mockResolvedValueOnce({
        rows: [
          {
            id: 7,
            username: "admin",
            role: "ADMIN",
          },
        ],
      });

      const res = await request(app).post("/api/telegram/unbind").send({
        telegramId: "777",
      });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        message: "Telegram успешно отвязан",
        user: {
          id: 7,
          username: "admin",
          role: "ADMIN",
        },
      });
    });
  });
});