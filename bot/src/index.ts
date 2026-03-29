import dotenv from "dotenv";
dotenv.config();

delete process.env.HTTP_PROXY;
delete process.env.HTTPS_PROXY;
delete process.env.http_proxy;
delete process.env.https_proxy;

import zlib from "zlib";
import { Markup, Telegraf } from "telegraf";
import {
  bindTelegramAccount,
  fetchDueSchedules,
  fetchMonthSalesReport,
  fetchReportsList,
  fetchTelegramMe,
  fetchTodaySalesReport,
  fetchWeekSalesReport,
  runReportById,
  SalesReportSummary,
  DueScheduleDto,
  sendDeliveryResult,
  unbindTelegramAccount,
} from "./api";

const token = process.env.BOT_TOKEN;
const backendBaseUrl = process.env.BACKEND_BASE_URL;

if (!token) {
  console.error("[bot] BOT_TOKEN is not set in .env");
  process.exit(1);
}

if (!backendBaseUrl) {
  console.error("[bot] BACKEND_BASE_URL is not set in .env");
  process.exit(1);
}

console.log("[bot] starting. BACKEND_BASE_URL =", backendBaseUrl);
console.log("[bot] BOT_TOKEN prefix =", token.slice(0, 12));

const bot = new Telegraf(token);

bot.use(async (ctx, next) => {
  console.log("[bot] update received:", ctx.updateType);
  await next();
});

bot.catch((err) => {
  console.error("[bot] runtime error", err);
});

/* ================= helpers ================= */

function formatMoney(value: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatSummaryText(
  title: string,
  summary: SalesReportSummary,
  periodLabel: string
): string {
  return [
    title,
    "",
    `Период: ${periodLabel}`,
    `Выручка: ${formatMoney(summary.totalRevenue)}`,
    `Заказы: ${summary.totalOrders}`,
    `Единицы: ${summary.totalQuantity}`,
    `Средний чек: ${formatMoney(summary.averageCheck)}`,
  ].join("\n");
}

function formatNamedReportText(
  name: string,
  summary: SalesReportSummary
): string {
  return [
    `Отчёт: ${name}`,
    "",
    `Выручка: ${formatMoney(summary.totalRevenue)}`,
    `Заказы: ${summary.totalOrders}`,
    `Единицы: ${summary.totalQuantity}`,
    `Средний чек: ${formatMoney(summary.averageCheck)}`,
  ].join("\n");
}

function makeCsvGzipBuffer(csv: string): Buffer {
  const csvWithBom = "\uFEFF" + csv;
  return zlib.gzipSync(Buffer.from(csvWithBom, "utf8"), { level: 6 });
}

function makeReportFilename(reportName: string): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 5).replace(":", "-");

  const safeName = reportName
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-zа-я0-9_-]/gi, "");

  return `${safeName}_${date}_${time}.csv.gz`;
}

function isPossibleBindCode(text: string): boolean {
  return /^[A-Z0-9]{6}$/.test(text.trim().toUpperCase());
}

async function safeAnswerCbQuery(
  ctx: { answerCbQuery?: (text?: string) => Promise<unknown> },
  text?: string
): Promise<void> {
  try {
    if (ctx.answerCbQuery) {
      await ctx.answerCbQuery(text);
    }
  } catch {
    // callback мог уже истечь
  }
}

async function getBoundTelegramUser(ctx: {
  from?: { id: number };
}): Promise<{
  id: number;
  username: string;
  role: "ADMIN" | "ANALYST" | "VIEWER";
  isActive: boolean;
  telegramId: string | null;
} | null> {
  if (!ctx.from?.id) {
    return null;
  }

  try {
    return await fetchTelegramMe(String(ctx.from.id));
  } catch (error) {
    console.error("[bot] fetchTelegramMe error", error);
    throw error;
  }
}

async function requireBoundUser(ctx: {
  reply: (text: string) => Promise<unknown>;
  from?: { id: number };
}) {
  const user = await getBoundTelegramUser(ctx);

  if (!user) {
    await ctx.reply(
      [
        "Сначала нужно привязать Telegram-аккаунт.",
        "Отправь одноразовый код, который выдал администратор.",
      ].join("\n")
    );
    return null;
  }

  return user;
}

function buildHelpText(boundUser?: {
  username: string;
  role: "ADMIN" | "ANALYST" | "VIEWER";
} | null): string {
  const lines = [
    boundUser
      ? `Пользователь: ${boundUser.username}`
      : "Аккаунт ещё не привязан",
    boundUser ? `Роль: ${boundUser.role}` : "Роль: —",
    "",
    "Доступные команды:",
    "/help — список команд",
    "/status — статус привязки и роль",
    "/today — отчёт за день",
    "/week — отчёт за 7 дней",
    "/month — отчёт за 30 дней",
    "/reports — список доступных отчётов",
    "/unbind — отвязать Telegram-аккаунт",
    "/myid — показать Telegram ID",
  ];

  if (!boundUser) {
    lines.push("", "Чтобы привязать аккаунт, отправь одноразовый код из 6 символов.");
  }

  return lines.join("\n");
}

function buildReportsKeyboard(reportButtons: { id: number; name: string }[]) {
  return Markup.inlineKeyboard(
    reportButtons.map((report) => [
      Markup.button.callback(report.name, `report_${report.id}`),
    ])
  );
}

async function sendReportToChat(params: {
  chatId: number;
  title: string;
  summary: SalesReportSummary;
  csv: string;
  filenameBase: string;
}): Promise<void> {
  const { chatId, title, summary, csv, filenameBase } = params;

  const text = formatNamedReportText(title, summary);
  const buffer = makeCsvGzipBuffer(csv);
  const filename = makeReportFilename(filenameBase);

  await bot.telegram.sendMessage(chatId, text);
  await bot.telegram.sendDocument(chatId, {
    source: buffer,
    filename,
  });
}

/* ================= schedules polling ================= */

function normalizeTelegramError(err: any): string {
  return (
    err?.response?.description ||
    err?.description ||
    err?.message ||
    "Telegram send error"
  );
}

function startSchedulePolling() {
  const intervalMs = 10_000;
  let running = false;

  console.log("[bot] schedule polling initialized, intervalMs =", intervalMs);

  const poll = async () => {
    if (running) {
      console.log("[bot] polling tick skipped: previous poll still running");
      return;
    }

    running = true;
    console.log("[bot] polling tick started");

    try {
      const schedules: DueScheduleDto[] = await fetchDueSchedules();

      console.log(
        "[bot] fetchDueSchedules result:",
        Array.isArray(schedules) ? schedules.length : "not-array"
      );

      if (!Array.isArray(schedules) || schedules.length === 0) {
        console.log("[bot] no due schedules");
        return;
      }

      for (const schedule of schedules) {
        console.log(
          `[bot] processing schedule scheduleId=${schedule.scheduleId} reportId=${schedule.reportId} recipients=${schedule.recipients?.length ?? 0}`
        );

        const text = formatNamedReportText(schedule.reportName, schedule.summary);
        const filename = makeReportFilename(schedule.reportName);
        const gzBuffer = makeCsvGzipBuffer(schedule.csv);

        for (const recipient of schedule.recipients ?? []) {
          const telegramId = recipient?.telegramId?.trim();

          if (!telegramId) {
            console.error(
              `[bot] skip recipient without telegramId: userId=${recipient?.userId} scheduleId=${schedule.scheduleId}`
            );

            try {
              await sendDeliveryResult({
                reportId: schedule.reportId,
                userId: recipient.userId,
                scheduleId: schedule.scheduleId,
                status: "ERROR",
                error: "Recipient telegramId is empty",
              });
            } catch (logErr) {
              console.error("[bot] failed to save empty telegramId ERROR log", logErr);
            }

            continue;
          }

          try {
            console.log(
              `[bot] sending scheduled report to telegramId=${telegramId} scheduleId=${schedule.scheduleId}`
            );

            await bot.telegram.sendMessage(telegramId, text);
            await bot.telegram.sendDocument(telegramId, {
              source: gzBuffer,
              filename,
            });

            await sendDeliveryResult({
              reportId: schedule.reportId,
              userId: recipient.userId,
              scheduleId: schedule.scheduleId,
              status: "SUCCESS",
            });

            console.log(
              `[bot] delivery success telegramId=${telegramId} scheduleId=${schedule.scheduleId}`
            );
          } catch (sendError: any) {
            const errorText = normalizeTelegramError(sendError);

            console.error(
              `[bot] failed to deliver scheduled report to telegramId=${telegramId} scheduleId=${schedule.scheduleId}: ${errorText}`,
              sendError
            );

            try {
              await sendDeliveryResult({
                reportId: schedule.reportId,
                userId: recipient.userId,
                scheduleId: schedule.scheduleId,
                status: "ERROR",
                error: errorText,
              });
            } catch (logErr) {
              console.error("[bot] failed to save delivery ERROR log", logErr);
            }
          }
        }
      }
    } catch (err) {
      console.error("[bot] schedule polling error", err);
    } finally {
      running = false;
      console.log("[bot] polling tick finished");
    }
  };

  void poll();

  const timer = setInterval(() => {
    void poll();
  }, intervalMs);

  // Не обязателен, но безопасен: не мешает завершению процесса.
  timer.unref?.();

  console.log("[bot] schedule polling started");
}

/* ================= commands ================= */

bot.start(async (ctx) => {
  console.log("[bot] /start from chat", ctx.chat.id);

  const user = await getBoundTelegramUser(ctx).catch(() => null);

  if (user) {
    await ctx.reply(
      [
        "Аккаунт уже привязан.",
        `Пользователь: ${user.username}`,
        `Роль: ${user.role}`,
        "",
        buildHelpText(user),
      ].join("\n")
    );
    return;
  }

  await ctx.reply(
    [
      "Привет!",
      "Чтобы привязать аккаунт, отправь одноразовый код, который тебе выдал администратор.",
      "",
      "Код должен состоять из 6 символов, например: ABC123",
    ].join("\n")
  );
});

bot.command("help", async (ctx) => {
  console.log("[bot] /help from chat", ctx.chat.id);

  const user = await getBoundTelegramUser(ctx).catch(() => null);
  await ctx.reply(buildHelpText(user));
});

bot.command("status", async (ctx) => {
  console.log("[bot] /status from chat", ctx.chat.id);

  try {
    const user = await getBoundTelegramUser(ctx);

    if (!user) {
      await ctx.reply(
        [
          "Статус: аккаунт не привязан.",
          `Telegram ID: ${ctx.from.id}`,
          "",
          "Отправь одноразовый код, чтобы завершить привязку.",
        ].join("\n")
      );
      return;
    }

    await ctx.reply(
      [
        "Статус подключения:",
        "✅ Telegram-аккаунт привязан",
        `Пользователь: ${user.username}`,
        `Роль: ${user.role}`,
        `Telegram ID: ${ctx.from.id}`,
      ].join("\n")
    );
  } catch (error) {
    console.error("[bot] /status error", error);
    await ctx.reply("Не удалось получить статус привязки.");
  }
});

bot.command("today", async (ctx) => {
  try {
    console.log("[bot] /today from chat", ctx.chat.id);

    const user = await requireBoundUser(ctx);
    if (!user) {
      return;
    }

    const report = await fetchTodaySalesReport();

    await ctx.reply(
      formatSummaryText("Отчёт по продажам", report.summary, "сегодня")
    );

    const buffer = makeCsvGzipBuffer(report.csv);
    const filename = makeReportFilename("Отчёт_за_день");

    await ctx.replyWithDocument({ source: buffer, filename });
  } catch (error) {
    console.error("[bot] /today error", error);
    await ctx.reply("Не удалось сформировать отчёт за день.");
  }
});

bot.command("week", async (ctx) => {
  try {
    console.log("[bot] /week from chat", ctx.chat.id);

    const user = await requireBoundUser(ctx);
    if (!user) {
      return;
    }

    const report = await fetchWeekSalesReport();

    await ctx.reply(
      formatSummaryText("Отчёт по продажам", report.summary, "последние 7 дней")
    );

    const buffer = makeCsvGzipBuffer(report.csv);
    const filename = makeReportFilename("Отчёт_за_неделю");

    await ctx.replyWithDocument({ source: buffer, filename });
  } catch (error) {
    console.error("[bot] /week error", error);
    await ctx.reply("Не удалось сформировать отчёт за неделю.");
  }
});

bot.command("month", async (ctx) => {
  try {
    console.log("[bot] /month from chat", ctx.chat.id);

    const user = await requireBoundUser(ctx);
    if (!user) {
      return;
    }

    const report = await fetchMonthSalesReport();

    await ctx.reply(
      formatSummaryText("Отчёт по продажам", report.summary, "последние 30 дней")
    );

    const buffer = makeCsvGzipBuffer(report.csv);
    const filename = makeReportFilename("Отчёт_за_месяц");

    await ctx.replyWithDocument({ source: buffer, filename });
  } catch (error) {
    console.error("[bot] /month error", error);
    await ctx.reply("Не удалось сформировать отчёт за месяц.");
  }
});

bot.command("reports", async (ctx) => {
  try {
    console.log("[bot] /reports from chat", ctx.chat.id);

    const user = await requireBoundUser(ctx);
    if (!user) {
      return;
    }

    const reports = await fetchReportsList();

    if (!reports.length) {
      await ctx.reply("Отчётов нет.");
      return;
    }

    await ctx.reply("Выберите отчёт:", buildReportsKeyboard(reports));
  } catch (error) {
    console.error("[bot] /reports error", error);
    await ctx.reply("Не удалось получить список отчётов.");
  }
});

bot.command("unbind", async (ctx) => {
  try {
    console.log("[bot] /unbind from chat", ctx.chat.id);

    const user = await requireBoundUser(ctx);
    if (!user) {
      return;
    }

    const result = await unbindTelegramAccount(String(ctx.from.id));

    if (!result.ok) {
      await ctx.reply(result.data?.message ?? "Не удалось отвязать аккаунт.");
      return;
    }

    await ctx.reply(
      [
        "Telegram-аккаунт отвязан.",
        "Чтобы привязать его снова, отправь новый одноразовый код.",
      ].join("\n")
    );
  } catch (error) {
    console.error("[bot] /unbind error", error);
    await ctx.reply("Не удалось отвязать аккаунт.");
  }
});

bot.command("myid", async (ctx) => {
  await ctx.reply(`Твой Telegram ID: ${ctx.from.id}`);
});

bot.on("text", async (ctx, next) => {
  const text = ctx.message.text.trim();

  if (text.startsWith("/")) {
    return next();
  }

  const boundUser = await getBoundTelegramUser(ctx).catch(() => null);

  if (boundUser) {
    await ctx.reply(
      [
        "Аккаунт уже привязан.",
        "Используй /help, чтобы посмотреть доступные команды.",
      ].join("\n")
    );
    return;
  }

  if (!isPossibleBindCode(text)) {
    await ctx.reply(
      "Аккаунт ещё не привязан. Отправь одноразовый код из 6 символов, например: ABC123"
    );
    return;
  }

  try {
    const result = await bindTelegramAccount({
      code: text.trim().toUpperCase(),
      telegramId: String(ctx.from.id),
      telegramUsername: ctx.from.username ?? null,
      telegramFirstName: ctx.from.first_name ?? null,
      telegramLastName: ctx.from.last_name ?? null,
    });

    if (!result.ok) {
      await ctx.reply(result.data?.message ?? "Не удалось привязать аккаунт.");
      return;
    }

    await ctx.reply(
      [
        "Аккаунт успешно привязан.",
        `Пользователь: ${result.data?.user?.username ?? "—"}`,
        `Роль: ${result.data?.user?.role ?? "—"}`,
        "",
        "Теперь доступны команды:",
        "/help",
        "/status",
        "/today",
        "/week",
        "/month",
        "/reports",
        "/unbind",
      ].join("\n")
    );
  } catch (error) {
    console.error("[bot] Telegram bind error", error);
    await ctx.reply("Ошибка связи с сервером. Попробуй позже.");
  }
});

bot.action(/^report_(\d+)$/, async (ctx) => {
  const reportId = Number((ctx.match as RegExpMatchArray)[1]);
  const chatId = ctx.callbackQuery?.message?.chat?.id;

  if (!chatId) {
    await safeAnswerCbQuery(ctx, "Чат не найден");
    return;
  }

  const user = await getBoundTelegramUser(ctx).catch(() => null);

  if (!user) {
    await safeAnswerCbQuery(ctx, "Сначала привяжи аккаунт");
    await bot.telegram.sendMessage(
      chatId,
      "Сначала нужно привязать Telegram-аккаунт. Отправь одноразовый код."
    );
    return;
  }

  await safeAnswerCbQuery(ctx, "Формирую отчёт…");
  await bot.telegram.sendMessage(chatId, "Отчёт формируется, файл будет отправлен.");

  void (async () => {
    try {
      const result = await runReportById(reportId);

      await sendReportToChat({
        chatId,
        title: result.reportName,
        summary: result.summary,
        csv: result.csv,
        filenameBase: result.reportName,
      });
    } catch (err) {
      console.error("[bot] run report by id error", err);
      await bot.telegram.sendMessage(chatId, "Ошибка формирования отчёта.");
    }
  })();
});

/* ================= launch ================= */

console.log("[bot] checking getMe...");
bot.telegram
  .getMe()
  .then((me) => {
    console.log("[bot] getMe ok:", me.username);
    return bot.telegram.deleteWebhook({ drop_pending_updates: true });
  })
  .then(() => {
    console.log("[bot] webhook deleted");
    startSchedulePolling();
    console.log("[bot] schedule polling started");
    return bot.launch();
  })
  .then(() => {
    console.log("[bot] launch resolved");
  })
  .catch((error) => {
    console.error("[bot] startup error", error);
    process.exit(1);
  });

process.once("SIGINT", () => {
  console.log("[bot] SIGINT");
  bot.stop("SIGINT");
});

process.once("SIGTERM", () => {
  console.log("[bot] SIGTERM");
  bot.stop("SIGTERM");
});