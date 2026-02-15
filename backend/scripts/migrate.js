import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import pg from "pg";

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Всегда читаем backend/.env независимо от того, откуда запускается скрипт
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

/**
 * Простейший раннер миграций.
 *
 * Запускает все файлы backend/migrations/*.sql в лексикографическом порядке.
 * Требуется DATABASE_URL в окружении.
 */
async function run() {
  const url = process.env.DATABASE_URL;

  if (!url) {
    console.error("[migrate] DATABASE_URL is not set");
    process.exit(1);
  }

  console.log("[migrate] DATABASE_URL =", url);

  const pool = new Pool({ connectionString: url });

  // process.cwd() при запуске npm run migrate обычно = backend/
  const migrationsDir = path.resolve(process.cwd(), "migrations");

  if (!fs.existsSync(migrationsDir)) {
    console.error(`[migrate] migrations dir not found: ${migrationsDir}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  console.log(`[migrate] found ${files.length} migration(s)`);

  try {
    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      console.log(`[migrate] applying ${file} ...`);
      await pool.query(sql);
    }
    console.log("[migrate] done ✅");
  } catch (e) {
    console.error("[migrate] error while applying migrations:", e?.message ?? e);
    throw e;
  } finally {
    await pool.end();
  }
}

run().catch((e) => {
  console.error("[migrate] fatal error", e);
  process.exit(1);
});
