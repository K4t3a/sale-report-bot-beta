import dotenv from "dotenv";
dotenv.config();

import zlib from "zlib";
import { Telegraf, Markup } from "telegraf";
import {
  bindTelegramUserByCode,
  fetchTodaySalesReport,
  fetchDueSchedules,
  fetchReportsList,
  runReportById,
  SalesReportSummary,
  DueScheduleDto,
} from "./api";

const token = process.env.BOT_TOKEN;

if (!token) {
  console.error("[bot] BOT_TOKEN is not set in .env");
  process.exit(1);
}

console.log("[bot] starting. BACKEND_BASE_URL =", process.env.BACKEND_BASE_URL);

const bot = new Telegraf(token);
const pendingCodeByChat = new Map<number, boolean>();

/* ================= helpers ================= */

function formatSummaryText(summary: SalesReportSummary): string {
  return [
    "Отчёт по продажам:",
    "",
    `Выручка: ${summary.totalRevenue.toFixed(2)}`,
    `Количество заказов: ${summary.totalOrders}`,
    `Количество единиц: ${summary.totalQuantity}`,
    `Средний чек: ${summary.averageCheck.toFixed(2)}`,
  ].join("\n");
}

function formatNamedReportText(name: string, summary: SalesReportSummary): string {
  return [
    `Отчёт: ${name}`,
    "",
    `Выручка: ${summary.totalRevenue.toFixed(2)}`,
    `Количество заказов: ${summary.totalOrders}`,
    `Количество единиц: ${summary.totalQuantity}`,
    `Средний чек: ${summary.averageCheck.toFixed(2)}`,
  ].join("\n");
}

function makeCsvGzipBuffer(csv: string): Buffer {
  const csvWithBom = "\uFEFF" + csv;
  return zlib.gzipSync(Buffer.from(csvWithBom, "utf8"), { level: 6 });
}

function makeReportFilename(reportName: string): string {
  const now = new Date();

  const date = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const time = now.toTimeString().slice(0, 5).replace(":", "-"); // HH-MM

  const safeName = reportName
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-zа-я0-9_-]/gi, "");

  return `${safeName}_${date}_${time}.csv.gz`;
}

async function safeAnswerCbQuery(ctx: any, text?: string) {
  try {
    await ctx.answerCbQuery(text);
  } catch {
    /* ignore expired callbacks */
  }
}

/* ================= schedules polling ================= */

function startSchedulePolling() {
  const intervalMs = 10_000;
  let running = false;

  const poll = async () => {
    if (running) return;
    running = true;

    try {
      const schedules: DueScheduleDto[] = await fetchDueSchedules();
      if (!schedules.length) return;

      for (const s of schedules) {
        const text = formatNamedReportText(s.reportName, s.summary);
        const gzBuffer = makeCsvGzipBuffer(s.csv);
        const filename = makeReportFilename(s.reportName);

        for (const r of s.recipients) {
          await bot.telegram.sendMessage(r.telegramId, text);
          await bot.telegram.sendDocument(r.telegramId, {
            source: gzBuffer,
            filename,
          });
        }
      }
    } catch (err) {
      console.error("[bot] schedule polling error", err);
    } finally {
      running = false;
    }
  };

  void poll();
  setInterval(poll, intervalMs);
}

/* ================= bot commands ================= */

bot.start(async (ctx) => {
  pendingCodeByChat.set(ctx.chat.id, true);
  await ctx.reply("Введите код, выданный администратором.");
});

bot.on("text", async (ctx, next) => {
  if (!pendingCodeByChat.get(ctx.chat.id)) return next();

  try {
    const result = await bindTelegramUserByCode({
      code: ctx.message.text.trim(),
      telegramId: String(ctx.from.id),
      username: ctx.from.username ?? undefined,
      firstName: ctx.from.first_name ?? undefined,
      lastName: ctx.from.last_name ?? undefined,
    });

    pendingCodeByChat.delete(ctx.chat.id);

    await ctx.reply(
      `Telegram привязан.\nВы вошли как ${result.username}.\n\nКоманда: /reports`
    );
  } catch {
    await ctx.reply("Неверный код. Попробуйте ещё раз.");
  }
});

bot.command("today", async (ctx) => {
  const report = await fetchTodaySalesReport();
  await ctx.reply(formatSummaryText(report.summary));

  const buffer = makeCsvGzipBuffer(report.csv);
  const filename = makeReportFilename("Отчёт_за_сегодня");

  await ctx.replyWithDocument({ source: buffer, filename });
});

bot.command("reports", async (ctx) => {
  const reports = await fetchReportsList();

  if (!reports.length) {
    await ctx.reply("Отчётов нет.");
    return;
  }

  await ctx.reply(
    "Выберите отчёт:",
    Markup.inlineKeyboard(
      reports.map((r) => [Markup.button.callback(r.name, `report_${r.id}`)])
    )
  );
});

/* ================= report by id ================= */

bot.action(/^report_(\d+)$/, async (ctx) => {
  const reportId = Number((ctx.match as RegExpMatchArray)[1]);

  const chatId = ctx.callbackQuery?.message?.chat?.id;
  if (!chatId) {
    await safeAnswerCbQuery(ctx, "Чат не найден");
    return;
  }

  await safeAnswerCbQuery(ctx, "Формирую отчёт…");
  await ctx.reply("Отчёт формируется, файл будет отправлен.");

  void (async () => {
    try {
      const result = await runReportById(reportId);
      const text = formatNamedReportText(result.reportName, result.summary);
      const buffer = makeCsvGzipBuffer(result.csv);
      const filename = makeReportFilename(result.reportName);

      await bot.telegram.sendMessage(chatId, text);
      await bot.telegram.sendDocument(chatId, { source: buffer, filename });
    } catch (err) {
      console.error("run report by id error", err);
      await bot.telegram.sendMessage(chatId, "Ошибка формирования отчёта.");
    }
  })();
});
/* ================= launch ================= */

bot.launch();
console.log("[bot] Bot launched");
startSchedulePolling();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
