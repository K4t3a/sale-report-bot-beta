import { Router } from "express";
import { query } from "../../lib/db";
import { findAndPrepareDueSchedules } from "./schedule.service";

/** Частота запуска расписания */
export type ScheduleFrequency = "DAILY" | "WEEKLY";

const router = Router();

router.post("/run-due", async (_req, res) => {
  try {
    const data = await findAndPrepareDueSchedules();
    res.json(data);
  } catch (error) {
    console.error("run-due error", error);
    res.status(500).json({ message: "Ошибка обработки расписаний" });
  }
});

router.get("/", async (_req, res) => {
  try {
    // Получаем расписания с присоединением отчёта и пользователей-получателей
    const rowsRes = await query<{
      scheduleId: number;
      hour: number;
      minute: number;
      frequency: ScheduleFrequency;
      weekday: number | null;
      isActive: boolean;
      reportId: number;
      reportName: string;
      userId: number | null;
      username: string | null;
      telegramId: string | null;
    }>(
      `
      SELECT
        s.id as "scheduleId",
        s.hour,
        s.minute,
        s.frequency,
        s.weekday,
        s.is_active as "isActive",
        r.id as "reportId",
        r.name as "reportName",
        u.id as "userId",
        u.username,
        u.telegram_id as "telegramId"
      FROM schedules s
      JOIN reports r ON r.id = s.report_id
      LEFT JOIN schedule_recipients sr ON sr.schedule_id = s.id
      LEFT JOIN users u ON u.id = sr.user_id
      ORDER BY s.id ASC, u.id ASC
      `
    );

    // Группируем строки в DTO
    const map = new Map<number, any>();
    for (const row of rowsRes.rows) {
      if (!map.has(row.scheduleId)) {
        map.set(row.scheduleId, {
          id: row.scheduleId,
          hour: row.hour,
          minute: row.minute,
          frequency: row.frequency,
          weekday: row.weekday,
          isActive: row.isActive,
          report: { id: row.reportId, name: row.reportName },
          recipients: [] as any[],
        });
      }
      const item = map.get(row.scheduleId);
      if (row.userId) {
        item.recipients.push({
          id: row.userId,
          username: row.username,
          telegramId: row.telegramId,
        });
      }
    }

    const dto = Array.from(map.values());

    res.json(dto);
  } catch (e) {
    console.error("get schedules error", e);
    res.status(500).json({ message: "Ошибка загрузки расписаний" });
  }
});

router.post("/", async (req, res) => {
  try {
    const {
      reportId,
      hour,
      minute,
      frequency,
      weekday,
      recipientIds,
    } = (req.body ?? {}) as {
      reportId?: number;
      hour?: number;
      minute?: number;
      frequency?: ScheduleFrequency;        
      weekday?: number;
      recipientIds?: number[];
    };

    if (!reportId || typeof hour !== "number" || typeof minute !== "number" || !frequency) {
      return res.status(400).json({
        message: "reportId, frequency, hour и minute обязательны",
      });
    }

    // Для WEEKLY требуется weekday (0..6)
    let safeWeekday: number | null = null;
    if (frequency === "WEEKLY") {
      if (typeof weekday !== "number" || weekday < 0 || weekday > 6) {
        return res.status(400).json({
          message: "Для WEEKLY укажите weekday (0..6), где 0 = воскресенье",
        });
      }
      safeWeekday = weekday;
    }

    const scheduleRes = await query<{
      id: number;
      hour: number;
      minute: number;
      frequency: ScheduleFrequency;
      weekday: number | null;
      isActive: boolean;
    }>(
      `
      INSERT INTO schedules (report_id, hour, minute, frequency, weekday, is_active)
      VALUES ($1, $2, $3, $4, $5, TRUE)
      RETURNING id, hour, minute, frequency, weekday, is_active as "isActive"
      `,
      [reportId, hour, minute, frequency, safeWeekday]
    );
    const schedule = scheduleRes.rows[0];

    const ids =
      Array.isArray(recipientIds) && recipientIds.length > 0
        ? recipientIds
        : [];

    if (ids.length > 0) {
      // Убираем дубли по (schedule_id, user_id)
      const values = ids.map((_, i) => `($1, $${i + 2})`).join(",");
      await query(
        `
        INSERT INTO schedule_recipients (schedule_id, user_id)
        VALUES ${values}
        ON CONFLICT (schedule_id, user_id) DO NOTHING
        `,
        [schedule.id, ...ids]
      );
    }

    // Возвращаем созданный объект (с отчётом и получателями)
    const createdRows = await query<{
      scheduleId: number;
      hour: number;
      minute: number;
      frequency: ScheduleFrequency;
      weekday: number | null;
      isActive: boolean;
      reportId: number;
      reportName: string;
      userId: number | null;
      username: string | null;
      telegramId: string | null;
    }>(
      `
      SELECT
        s.id as "scheduleId",
        s.hour,
        s.minute,
        s.frequency,
        s.weekday,
        s.is_active as "isActive",
        r.id as "reportId",
        r.name as "reportName",
        u.id as "userId",
        u.username,
        u.telegram_id as "telegramId"
      FROM schedules s
      JOIN reports r ON r.id = s.report_id
      LEFT JOIN schedule_recipients sr ON sr.schedule_id = s.id
      LEFT JOIN users u ON u.id = sr.user_id
      WHERE s.id = $1
      ORDER BY u.id ASC
      `,
      [schedule.id]
    );

    const base = createdRows.rows[0];
    const payload = {
      id: base.scheduleId,
      hour: base.hour,
      minute: base.minute,
      frequency: base.frequency,
      weekday: base.weekday,
      isActive: base.isActive,
      report: { id: base.reportId, name: base.reportName },
      recipients: createdRows.rows
        .filter((r) => r.userId)
        .map((r) => ({
          id: r.userId,
          username: r.username,
          telegramId: r.telegramId,
        })),
    };

    res.status(201).json(payload);
  } catch (err) {
    console.error("create schedule error", err);
    res.status(500).json({ message: "Ошибка создания расписания" });
  }
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isFinite(id)) {
    return res.status(400).json({ message: "Некорректный id расписания" });
  }

  try {
    await query(`DELETE FROM schedule_recipients WHERE schedule_id = $1`, [id]);
    await query(`DELETE FROM schedules WHERE id = $1`, [id]);

    res.status(204).send();
  } catch (err: any) {
    console.error("delete schedule error", err);
    res.status(500).json({ message: "Ошибка удаления расписания" });
  }
});

export default router;
