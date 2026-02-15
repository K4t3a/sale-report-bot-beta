import { Pool, type QueryResultRow } from "pg";

/**
 * Общий пул соединений к PostgreSQL.
 *
 * Подключение задаётся через переменную окружения DATABASE_URL.
 * 
 */
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  // Ошибка конфигурации лучше проявится сразу при старте, чем "внезапно" во время запроса.
  throw new Error(
    "DATABASE_URL is not set. Add it to backend/.env (example: postgresql://user:pass@127.0.0.1:5432/sales)"
  );
}

export const pool = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

/**
 * Безопасный helper для выполнения SQL-запросов.
 *
 * @param text SQL (с плейсхолдерами $1, $2, ...)
 * @param params параметры плейсхолдеров
 */
export async function query<T extends QueryResultRow>(
  text: string,
  params: unknown[] = []
) {
  try {
    return await pool.query<T>(text, params);
  } catch (e) {
    // Логи уровня БД (без утечки параметров наружу)
    console.error("[db] query failed", {
      message: (e as any)?.message,
      code: (e as any)?.code,
    });
    throw e;
  }
}
