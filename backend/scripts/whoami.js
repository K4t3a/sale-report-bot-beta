import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  const r = await pool.query("select inet_server_addr() as addr, inet_server_port() as port, version() as v");
  console.log("[whoami]", r.rows[0]);
} catch (e) {
  console.error("[whoami] error:", e.message);
} finally {
  await pool.end();
}
