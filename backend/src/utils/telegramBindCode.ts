const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// Генерируем код без похожих символов вроде O/0 и I/1,
// чтобы пользователю было проще ввести его в Telegram без ошибок.
export function generateTelegramBindCode(length = 6): string {
  const size = Number.isFinite(length) && length >= 4 && length <= 12
    ? Math.floor(length)
    : 6;

  let result = "";

  for (let i = 0; i < size; i += 1) {
    const index = Math.floor(Math.random() * ALPHABET.length);
    result += ALPHABET[index];
  }

  return result;
}
