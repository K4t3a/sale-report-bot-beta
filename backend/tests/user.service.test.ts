/// <reference types="jest" />

jest.mock("../src/lib/db", () => ({
  query: jest.fn(),
}));

jest.mock("../src/utils/telegramBindCode", () => ({
  generateTelegramBindCode: jest.fn(),
}));

import { query } from "../src/lib/db";
import { generateTelegramBindCode } from "../src/utils/telegramBindCode";
import {
  registerTelegramUser,
  createTelegramBindCode,
  bindTelegramAccountByCode,
} from "../src/modules/users/user.service";

const queryMock = query as unknown as jest.Mock;
const generateTelegramBindCodeMock =
  generateTelegramBindCode as unknown as jest.Mock;

describe("user.service", () => {
  beforeEach(() => {
    queryMock.mockReset();
    generateTelegramBindCodeMock.mockReset();
  });

  describe("registerTelegramUser", () => {
    test("возвращает существующего пользователя, если telegram уже привязан", async () => {
      queryMock.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            username: "viewer_1",
            telegramId: "777",
            isActive: true,
            role: "VIEWER",
          },
        ],
      });

      const result = await registerTelegramUser({
        telegramId: "777",
      });

      expect(result).toEqual({
        id: 1,
        username: "viewer_1",
        telegramId: "777",
        isActive: true,
        role: "VIEWER",
      });
    });

    test("создаёт нового пользователя, если telegram не найден", async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ id: 2, username: "tg_888" }],
        });

      const result = await registerTelegramUser({
        telegramId: "888",
      });

      expect(result).toEqual({
        id: 2,
        username: "tg_888",
      });
    });
  });

  describe("createTelegramBindCode", () => {
    test("генерирует код и возвращает данные", async () => {
      generateTelegramBindCodeMock.mockReturnValueOnce("ABC123");

      queryMock.mockResolvedValueOnce({
        rows: [
          {
            id: 5,
            username: "viewer_1",
            telegramBindCode: "ABC123",
            telegramBindExpiresAt: "2026-03-29T12:00:00.000Z",
          },
        ],
      });

      const result = await createTelegramBindCode(5);

      expect(generateTelegramBindCodeMock).toHaveBeenCalledWith(6);
      expect(result).toEqual({
        id: 5,
        username: "viewer_1",
        telegramBindCode: "ABC123",
        telegramBindExpiresAt: "2026-03-29T12:00:00.000Z",
      });
    });

    test("возвращает null, если пользователь не найден", async () => {
      generateTelegramBindCodeMock.mockReturnValueOnce("ABC123");
      queryMock.mockResolvedValueOnce({ rows: [] });

      const result = await createTelegramBindCode(999);

      expect(result).toBeNull();
    });
  });

  describe("bindTelegramAccountByCode", () => {
    test("привязывает telegram по коду", async () => {
      queryMock.mockResolvedValueOnce({
        rows: [{ id: 7, username: "viewer_7", role: "VIEWER" }],
      });

      const result = await bindTelegramAccountByCode({
        code: "ABC123",
        telegramId: "777",
        telegramUsername: "tg_user",
        telegramFirstName: "Ivan",
        telegramLastName: "Petrov",
      });

      expect(result).toEqual({
        id: 7,
        username: "viewer_7",
        role: "VIEWER",
      });
    });

    test("возвращает null, если код не подошёл", async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      const result = await bindTelegramAccountByCode({
        code: "BAD999",
        telegramId: "777",
      });

      expect(result).toBeNull();
    });
  });
});