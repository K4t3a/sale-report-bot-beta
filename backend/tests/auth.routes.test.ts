/// <reference types="jest" />

import request from "supertest";

// Мокаем db.query до импорта app (иначе реальные импорты подтянут db.ts).
jest.mock("../src/lib/db", () => ({
  query: jest.fn(),
}));

jest.mock("bcrypt", () => ({
  compare: jest.fn(),
}));

import app from "../src/app";
import { query } from "../src/lib/db";
import bcrypt from "bcrypt";

const queryMock = query as unknown as jest.Mock;
const bcryptCompareMock = bcrypt.compare as unknown as jest.Mock;

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    queryMock.mockReset();
    bcryptCompareMock.mockReset();
  });

  test("400: если не переданы username/password", async () => {
    const res = await request(app).post("/api/auth/login").send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/логин/i);
  });

  test("401: если пользователь не найден", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin", password: "x" });

    expect(res.status).toBe(401);
  });

  test("401: если пользователь не ADMIN или не active", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          username: "u",
          role: "VIEWER",
          isActive: true,
          passwordHash: "hash",
        },
      ],
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "u", password: "x" });

    expect(res.status).toBe(401);
  });

  test("401: если пароль не совпал", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          username: "admin",
          role: "ADMIN",
          isActive: true,
          passwordHash: "hash",
        },
      ],
    });
    bcryptCompareMock.mockResolvedValueOnce(false);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin", password: "wrong" });

    expect(res.status).toBe(401);
  });

  test("200: возвращает token при успешном входе", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          username: "admin",
          role: "ADMIN",
          isActive: true,
          passwordHash: "hash",
        },
      ],
    });
    bcryptCompareMock.mockResolvedValueOnce(true);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin", password: "admin" });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
    expect(res.body.user).toMatchObject({
      id: 1,
      username: "admin",
      role: "ADMIN",
    });
  });
});
