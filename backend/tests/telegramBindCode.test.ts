/// <reference types="jest" />

import { generateTelegramBindCode } from "../src/utils/telegramBindCode";

describe("generateTelegramBindCode", () => {
  test("по умолчанию длина 6", () => {
    const code = generateTelegramBindCode();
    expect(code).toHaveLength(6);
  });

  test("можно задать длину 8", () => {
    const code = generateTelegramBindCode(8);
    expect(code).toHaveLength(8);
  });

  test("если длина слишком маленькая, берётся 6", () => {
    const code = generateTelegramBindCode(2);
    expect(code).toHaveLength(6);
  });

  test("используются только допустимые символы", () => {
    const code = generateTelegramBindCode(10);
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/);
  });
});