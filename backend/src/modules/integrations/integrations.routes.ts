import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { query } from "../../lib/db";
import { requireAuth, requireRoles } from "../../middleware/auth";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

type ParsedSaleRow = {
  saleDate: string;
  productName: string;
  customerName: string;
  quantity: number;
  price: number;
};

type RawRow = Record<string, unknown>;

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function toSafeString(value: unknown): string {
  return String(value ?? "").trim();
}

function parsePositiveNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }

  const normalized = String(value ?? "")
    .trim()
    .replace(",", ".");

  const parsed = Number(normalized);
  return parsed;
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00`);
  return !Number.isNaN(parsed.getTime());
}

function mapRawRow(row: RawRow, index: number): ParsedSaleRow {
  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row)) {
    normalized[normalizeHeader(key)] = value;
  }

  const saleDate = toSafeString(normalized.sale_date);
  const productName = toSafeString(normalized.product_name);
  const customerName = toSafeString(normalized.customer_name);
  const quantity = parsePositiveNumber(normalized.quantity);
  const price = parsePositiveNumber(normalized.price);

  if (!saleDate || !productName || !customerName) {
    throw new Error(`Строка ${index}: не заполнены обязательные поля`);
  }

  if (!isValidIsoDate(saleDate)) {
    throw new Error(`Строка ${index}: sale_date должен быть в формате YYYY-MM-DD`);
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error(`Строка ${index}: quantity должен быть положительным числом`);
  }

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`Строка ${index}: price должен быть положительным числом`);
  }

  return {
    saleDate,
    productName,
    customerName,
    quantity,
    price,
  };
}

function parseCsv(buffer: Buffer): RawRow[] {
  const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("CSV-файл пустой или не содержит данных");
  }

  const headers = lines[0].split(",").map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((cell) => cell.trim());
    const row: RawRow = {};

    headers.forEach((header, index) => {
      row[header] = cells[index] ?? "";
    });

    return row;
  });
}

function parseXlsx(buffer: Buffer): RawRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error("XLSX-файл не содержит листов");
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<RawRow>(worksheet, {
    defval: "",
  });

  if (!rows.length) {
    throw new Error("XLSX-файл пустой или не содержит строк");
  }

  return rows;
}

router.use(requireAuth, requireRoles("ADMIN", "ANALYST"));

router.get("/template", async (_req, res) => {
  return res.json({
    requiredColumns: [
      "sale_date",
      "product_name",
      "customer_name",
      "quantity",
      "price",
    ],
    exampleRow: {
      sale_date: "2026-03-01",
      product_name: "Ноутбук",
      customer_name: "ООО Альфа",
      quantity: 2,
      price: 65000,
    },
    acceptedFormats: ["csv", "xlsx"],
  });
});

router.post("/import", upload.single("file"), async (req, res) => {
  try {
    const uploadedFile = req.file;

    if (!uploadedFile) {
      return res.status(400).json({
        message: "Файл не передан",
      });
    }

    const ext = uploadedFile.originalname.split(".").pop()?.toLowerCase();

    if (ext !== "csv" && ext !== "xlsx") {
      return res.status(400).json({
        message: "Поддерживаются только CSV и XLSX",
      });
    }

    const rawRows = ext === "csv"
      ? parseCsv(uploadedFile.buffer)
      : parseXlsx(uploadedFile.buffer);

    const parsedRows = rawRows.map((row, index) => mapRawRow(row, index + 2));

    if (!parsedRows.length) {
      return res.status(400).json({
        message: "Файл не содержит валидных данных",
      });
    }

    await query("BEGIN");

    for (const row of parsedRows) {
      await query(
        `
        INSERT INTO sale_demo (
          sale_date,
          product_name,
          customer_name,
          quantity,
          price
        )
        VALUES ($1, $2, $3, $4, $5)
        `,
        [
          row.saleDate,
          row.productName,
          row.customerName,
          row.quantity,
          row.price,
        ]
      );
    }

    await query("COMMIT");

    const totalRevenue = parsedRows.reduce(
      (sum, row) => sum + row.quantity * row.price,
      0
    );

    return res.json({
      message: "Импорт выполнен успешно",
      importedRows: parsedRows.length,
      totalRevenue,
      filename: uploadedFile.originalname,
    });
  } catch (err) {
    await query("ROLLBACK").catch(() => null);

    console.error("POST /api/integrations/import error", err);

    return res.status(500).json({
      message: err instanceof Error ? err.message : "Ошибка импорта данных",
    });
  }
});

export default router;