import dotenv from "dotenv";
import { Pool } from "pg";
import bcrypt from "bcrypt";

dotenv.config();

/**
 * Seed-скрипт для бета-версии:
 * - наполняет БД демонстрационными продажами (sale_demo) в большом объёме
 * - создаёт базовые отчёты и пользователей
 *
 * Управление:
 *  - SEED_COUNT: сколько продаж создать (по умолчанию 50000)
 *  - SEED_DAYS: за сколько дней раскидать продажи (по умолчанию 30)
 *  - ADMIN_USERNAME, ADMIN_PASSWORD: админ для входа в панель (по умолчанию admin/admin)
 */

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[seed] DATABASE_URL is not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: url });

const customers = [
  "ООО «Ромашка»",
  "ИП Иванов",
  "ООО «ТехноМир»",
  "ООО «Мегаплюс»",
  "ИП Петров",
  "ООО «СеверСтрой»",
  "ООО «Вектор»",
  "ИП Смирнов",
  "ООО «АльфаТрейд»",
  "ООО «Спектр»",
];

const products = [
  { name: "Ноутбук X1", price: 60000 },
  { name: "Смартфон Y", price: 30000 },
  { name: "Планшет Z", price: 45000 },
  { name: "Монитор 24\"", price: 15000 },
  { name: "Клавиатура механическая", price: 5000 },
  { name: "Мышь беспроводная", price: 2500 },
  { name: "Наушники", price: 8000 },
  { name: "SSD 1TB", price: 9000 },
];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function upsertAdmin() {
  const adminUsername = process.env.ADMIN_USERNAME || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin";
  const hash = await bcrypt.hash(adminPassword, 10);

  await pool.query(
    `
    INSERT INTO users (username, password_hash, role, is_active)
    VALUES ($1, $2, 'ADMIN', TRUE)
    ON CONFLICT (username)
    DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'ADMIN', is_active = TRUE
    `,
    [adminUsername, hash]
  );

  console.log(`[seed] admin user ensured: ${adminUsername}`);
}

async function ensureReports() {
  const reports = [
    {
      name: "Ежедневный отчёт по продажам",
      description: "Сводка продаж за день",
      periodType: "DAY",
      sqlTemplate:
        "SELECT * FROM sale_demo WHERE sale_date BETWEEN :from AND :to ORDER BY sale_date ASC",
    },
    {
      name: "Отчёт за 7 дней",
      description: "Сводка продаж за последнюю неделю",
      periodType: "WEEK",
      sqlTemplate:
        "SELECT * FROM sale_demo WHERE sale_date BETWEEN :from AND :to ORDER BY sale_date ASC",
    },
  ];

  for (const r of reports) {
    await pool.query(
      `
      INSERT INTO reports (name, description, period_type, sql_template, is_active)
      VALUES ($1, $2, $3, $4, TRUE)
      ON CONFLICT DO NOTHING
      `,
      [r.name, r.description, r.periodType, r.sqlTemplate]
    );
  }

  console.log("[seed] reports ensured");
}

async function seedSales() {
  const count = Number(process.env.SEED_COUNT || 100000);
  const days = Number(process.env.SEED_DAYS || 30);

  console.log(`[seed] clearing sale_demo ...`);
  await pool.query("DELETE FROM sale_demo");

  const now = new Date();

  // Вставляем батчами, чтобы не упереться в лимиты на количество параметров.
  const batchSize = 1000;
  let created = 0;

  while (created < count) {
    const left = count - created;
    const size = Math.min(batchSize, left);

    const values = [];
    const params = [];
    let p = 1;

    for (let i = 0; i < size; i++) {
      const daysAgo = randInt(0, Math.max(0, days - 1));
      const saleDate = new Date(now);
      saleDate.setDate(now.getDate() - daysAgo);
      saleDate.setHours(randInt(9, 18), randInt(0, 59), 0, 0);

      const product = pickRandom(products);
      const quantity = randInt(1, 5);

      // 1–2% аномалий (для демонстрации обработки): иногда пустой customer.
      const anomaly = Math.random() < 0.015;
      const customer = anomaly ? "ООО «(не указан)»" : pickRandom(customers);

      values.push(`($${p++}, $${p++}, $${p++}, $${p++}, $${p++})`);
      params.push(customer, product.name, quantity, product.price, saleDate);
    }

    await pool.query(
      `
      INSERT INTO sale_demo (customer, product, quantity, price, sale_date)
      VALUES ${values.join(",")}
      `,
      params
    );

    created += size;
    if (created % 5000 === 0 || created === count) {
      console.log(`[seed] inserted ${created}/${count}`);
    }
  }

  console.log("[seed] sales seeded ✅");
}
async function addUser(username, password, role) {
  const hash = await bcrypt.hash(password, 10);

  await pool.query(
    `
    INSERT INTO users (username, password_hash, role, is_active)
    VALUES ($1, $2, $3, TRUE)
    ON CONFLICT (username)
    DO UPDATE SET role = EXCLUDED.role, is_active = TRUE
    `,
    [username, hash, role]
  );
}

async function main() {
  await upsertAdmin();
  await ensureReports();
  await seedSales();
  await addUser("shmel27", "123456", "VIEWER");
}

main()
  .catch((e) => {
    console.error("[seed] error", e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
