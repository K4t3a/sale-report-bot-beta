import { query } from "../../lib/db";
import type { ScheduleFrequency } from "./schedule.routes";
import {
  generateSalesReport,
  buildCsvWithSummary,
  type SalesReportSummary,
  type ReportPeriodKey,
} from "../reports/report.service";

export type DeliveryStatus = "SUCCESS" | "ERROR";

export interface DueRecipientDto {
  userId: number;
  telegramId: string;
}

export interface DueScheduleDto {
  scheduleId: number;
  reportName: string;
  summary: SalesReportSummary;
  /**
   * CSV-файл, уже дополненный блоком summary (удобно для Excel/Sheets).
   * В боте отправляется как .csv.gz.
   */
  csv: string;
  recipients: DueRecipientDto[];
}

/**
 * В БД отчёты хранят тип периода (DAY/WEEK/MONTH).
 * В генераторе отчётов используем «ключи периода» (today/last7days/last30days).
 */
function mapPeriodTypeToKey(periodType: string): ReportPeriodKey {
  if (periodType === "DAY") return "today";
  if (periodType === "WEEK") return "last7days";
  if (periodType === "MONTH") return "last30days";
  return "today";
}

/**
 * Ищет «пора отправлять» расписания и подготавливает данные для доставки:
 *  - находит активные schedules, совпадающие с текущими hour/minute;
 *  - для WEEKLY дополнительно проверяет weekday;
 *  - собирает получателей (только активные пользователи с telegram_id);
 *  - формирует отчёт (summary + CSV) и возвращает список задач на отправку.
 *
 * Важная оговорка: здесь же фиксируется лог доставки SUCCESS, чтобы
 * защититься от дублей в пределах одной минуты (см. minuteStart).
 */
export async function findAndPrepareDueSchedules(): Promise<DueScheduleDto[]> {
  // Текущее время используется как «критерий готовности» расписаний.
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentWeekday = now.getDay(); 

  const minuteStart = new Date(now);
  minuteStart.setSeconds(0, 0);

  // Берём расписания, которые совпадают по часу/минуте.
  // Для WEEKLY дополнительно фильтруем по weekday ниже.
  const schedulesRes = await query<{
    scheduleId: number;
    reportId: number;
    reportName: string;
    periodType: "DAY" | "WEEK" | "MONTH";
    frequency: ScheduleFrequency;
    weekday: number | null;
    userId: number | null;
    telegramId: string | null;
    isUserActive: boolean | null;
  }>(
    `
    SELECT
      s.id as "scheduleId",
      s.report_id as "reportId",
      r.name as "reportName",
      r.period_type as "periodType",
      s.frequency,
      s.weekday,
      u.id as "userId",
      u.telegram_id as "telegramId",
      u.is_active as "isUserActive"
    FROM schedules s
    JOIN reports r ON r.id = s.report_id
    LEFT JOIN schedule_recipients sr ON sr.schedule_id = s.id
    LEFT JOIN users u ON u.id = sr.user_id
    WHERE s.is_active = TRUE AND s.hour = $1 AND s.minute = $2
    ORDER BY s.id ASC
    `,
    [currentHour, currentMinute]
  );

  if (!schedulesRes.rows.length) {
    return [];
  }

  // Группируем по scheduleId (из SQL пришёл «плоский» список schedule × recipient)
  const bySchedule = new Map<
    number,
    {
      scheduleId: number;
      reportId: number;
      reportName: string;
      periodType: "DAY" | "WEEK" | "MONTH";
      frequency: ScheduleFrequency;
      weekday: number | null;
      recipients: DueRecipientDto[];
    }
  >();

  for (const row of schedulesRes.rows) {
    if (!bySchedule.has(row.scheduleId)) {
      bySchedule.set(row.scheduleId, {
        scheduleId: row.scheduleId,
        reportId: row.reportId,
        reportName: row.reportName,
        periodType: row.periodType,
        frequency: row.frequency,
        weekday: row.weekday,
        recipients: [],
      });
    }

    if (row.userId && row.telegramId && row.isUserActive) {
      bySchedule.get(row.scheduleId)!.recipients.push({
        userId: row.userId,
        telegramId: row.telegramId,
      });
    }
  }

  const schedules = Array.from(bySchedule.values());

  const results: DueScheduleDto[] = [];

  for (const s of schedules) {
    // WEEKLY отправляем только в нужный день недели.
    if (s.frequency === "WEEKLY" && s.weekday != null && s.weekday !== currentWeekday) {
      continue;
    }

    // Антидубль: если в текущей минуте уже был SUCCESS — пропускаем.
    const alreadySentRes = await query<{ id: number }>(
      `
      SELECT id
      FROM delivery_logs
      WHERE schedule_id = $1 AND sent_at >= $2 AND status = 'SUCCESS'
      LIMIT 1
      `,
      [s.scheduleId, minuteStart]
    );
    const alreadySent = alreadySentRes.rows[0];

    if (alreadySent) {
      continue;
    }

    const recipients: DueRecipientDto[] = s.recipients;

    if (!recipients.length) {
      continue;
    }

    // Выбор периода отчёта зависит от periodType, заданного в report.
    const periodKey = mapPeriodTypeToKey(s.periodType as string);

    const reportResult = await generateSalesReport(periodKey);
    const fullCsv = buildCsvWithSummary(
      s.reportName,
      reportResult.summary,
      reportResult.csv
    );

    results.push({
      scheduleId: s.scheduleId,
      reportName: s.reportName,
      summary: reportResult.summary,
      csv: fullCsv,
      recipients,
    });

    // Логи доставки пишем пакетно (по одной строке на получателя).
    if (recipients.length) {
      const values = recipients
        .map((_, i) => {
          const base = i * 3;
          return `($${base + 1}, $${base + 2}, $${base + 3}, 'SUCCESS')`;
        })
        .join(",");

      const params: any[] = [];
      for (const r of recipients) {
        params.push(s.reportId, r.userId, s.scheduleId);
      }

      await query(
        `
        INSERT INTO delivery_logs (report_id, user_id, schedule_id, status)
        VALUES ${values}
        `,
        params
      );
    }
  }

  return results;
}
