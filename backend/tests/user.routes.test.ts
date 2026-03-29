/// <reference types="jest" />

import request from "supertest";
import jwt from "jsonwebtoken";

jest.mock("../src/lib/db", () => ({
  query: jest.fn(),
}));

jest.mock("bcrypt", () => ({
  hash: jest.fn(),
}));

jest.mock("../src/modules/users/user.service", () => ({
  createTelegramBindCode: jest.fn(),
}));

import app from "../src/app";
import { query } from "../src/lib/db";
import bcrypt from "bcrypt";
import { createTelegramBindCode } from "../src/modules/users/user.service";

const queryMock = query as unknown as jest.Mock;
const bcryptHashMock = bcrypt.hash as unknown as jest.Mock;
const createTelegramBindCodeMock = createTelegramBindCode as unknown as jest.Mock;

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

function makeToken(payload: {
  id: number;
  username: string;
  role: "ADMIN" | "ANALYST" | "VIEWER";
}) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });
}

describe("Users routes", () => {
  beforeEach(() => {
    queryMock.mockReset();
    bcryptHashMock.mockReset();
    createTelegramBindCodeMock.mockReset();
  });

  describe("GET /api/users", () => {
    test("403: ANALYST не может получить весь список пользователей", async () => {
      const token = makeToken({
        id: 2,
        username: "analyst",
        role: "ANALYST",
      });

      queryMock.mockResolvedValueOnce({
        rows: [{ id: 2, username: "analyst", role: "ANALYST", isActive: true }],
      });

      const res = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    test("200: ADMIN получает список пользователей", async () => {
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
              username: "admin",
              role: "ADMIN",
              isActive: true,
              telegramId: null,
              bindCode: null,
              bindCodeExpiresAt: null,
              createdAt: "2026-03-01T00:00:00.000Z",
            },
          ],
        });

      const res = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe("GET /api/users/telegram", () => {
    test("200: ANALYST может получить список telegram-пользователей", async () => {
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
          rows: [{ id: 5, username: "viewer_1", telegramId: "777" }],
        });

      const res = await request(app)
        .get("/api/users/telegram")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body[0]).toEqual({
        id: 5,
        username: "viewer_1",
        telegramId: "777",
      });
    });
  });

  describe("POST /api/users", () => {
    test("400: слишком короткий логин", async () => {
      const token = makeToken({
        id: 1,
        username: "admin",
        role: "ADMIN",
      });

      queryMock.mockResolvedValueOnce({
        rows: [{ id: 1, username: "admin", role: "ADMIN", isActive: true }],
      });

      const res = await request(app)
        .post("/api/users")
        .set("Authorization", `Bearer ${token}`)
        .send({
          username: "ab",
          password: "1234",
          role: "VIEWER",
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/логин/i);
    });

    test("400: слишком короткий пароль", async () => {
      const token = makeToken({
        id: 1,
        username: "admin",
        role: "ADMIN",
      });

      queryMock.mockResolvedValueOnce({
        rows: [{ id: 1, username: "admin", role: "ADMIN", isActive: true }],
      });

      const res = await request(app)
        .post("/api/users")
        .set("Authorization", `Bearer ${token}`)
        .send({
          username: "user1",
          password: "123",
          role: "VIEWER",
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/пароль/i);
    });

    test("409: пользователь уже существует", async () => {
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
          rows: [{ id: 10 }],
        });

      const res = await request(app)
        .post("/api/users")
        .set("Authorization", `Bearer ${token}`)
        .send({
          username: "user1",
          password: "1234",
          role: "VIEWER",
        });

      expect(res.status).toBe(409);
    });

    test("201: успешное создание пользователя", async () => {
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
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 11,
              username: "new_user",
              role: "VIEWER",
              isActive: true,
              telegramId: null,
              bindCode: null,
              bindCodeExpiresAt: null,
              createdAt: "2026-03-01T00:00:00.000Z",
            },
          ],
        });

      bcryptHashMock.mockResolvedValueOnce("hashed_password");

      const res = await request(app)
        .post("/api/users")
        .set("Authorization", `Bearer ${token}`)
        .send({
          username: "new_user",
          password: "1234",
          role: "VIEWER",
          isActive: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.username).toBe("new_user");
    });
  });

  describe("PATCH /api/users/:id/status", () => {
    test("400: некорректный id", async () => {
      const token = makeToken({
        id: 1,
        username: "admin",
        role: "ADMIN",
      });

      queryMock.mockResolvedValueOnce({
        rows: [{ id: 1, username: "admin", role: "ADMIN", isActive: true }],
      });

      const res = await request(app)
        .patch("/api/users/abc/status")
        .set("Authorization", `Bearer ${token}`)
        .send({ isActive: false });

      expect(res.status).toBe(400);
    });

    test("400: если isActive не передан", async () => {
      const token = makeToken({
        id: 1,
        username: "admin",
        role: "ADMIN",
      });

      queryMock.mockResolvedValueOnce({
        rows: [{ id: 1, username: "admin", role: "ADMIN", isActive: true }],
      });

      const res = await request(app)
        .patch("/api/users/5/status")
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
    });

    test("404: пользователь не найден", async () => {
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
        .patch("/api/users/5/status")
        .set("Authorization", `Bearer ${token}`)
        .send({ isActive: false });

      expect(res.status).toBe(404);
    });

    test("200: статус пользователя обновлён", async () => {
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
              id: 5,
              username: "user5",
              role: "VIEWER",
              isActive: false,
              telegramId: null,
              bindCode: null,
              bindCodeExpiresAt: null,
              createdAt: "2026-03-01T00:00:00.000Z",
            },
          ],
        });

      const res = await request(app)
        .patch("/api/users/5/status")
        .set("Authorization", `Bearer ${token}`)
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.isActive).toBe(false);
    });
  });

  describe("POST /api/users/:id/telegram-bind-code", () => {
    test("400: некорректный id", async () => {
      const token = makeToken({
        id: 1,
        username: "admin",
        role: "ADMIN",
      });

      queryMock.mockResolvedValueOnce({
        rows: [{ id: 1, username: "admin", role: "ADMIN", isActive: true }],
      });

      const res = await request(app)
        .post("/api/users/abc/telegram-bind-code")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
    });

    test("404: если пользователь не найден", async () => {
      const token = makeToken({
        id: 1,
        username: "admin",
        role: "ADMIN",
      });

      queryMock.mockResolvedValueOnce({
        rows: [{ id: 1, username: "admin", role: "ADMIN", isActive: true }],
      });

      createTelegramBindCodeMock.mockResolvedValueOnce(null);

      const res = await request(app)
        .post("/api/users/10/telegram-bind-code")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    test("200: bind-code сгенерирован", async () => {
      const token = makeToken({
        id: 1,
        username: "admin",
        role: "ADMIN",
      });

      queryMock.mockResolvedValueOnce({
        rows: [{ id: 1, username: "admin", role: "ADMIN", isActive: true }],
      });

      createTelegramBindCodeMock.mockResolvedValueOnce({
        id: 10,
        username: "viewer_1",
        telegramBindCode: "ABC123",
        telegramBindExpiresAt: "2026-03-29T12:00:00.000Z",
      });

      const res = await request(app)
        .post("/api/users/10/telegram-bind-code")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/сгенерирован/i);
      expect(res.body.data.telegramBindCode).toBe("ABC123");
    });
  });
});