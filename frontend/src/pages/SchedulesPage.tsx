import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import PageHeader from "../components/ui/PageHeader";
import Badge from "../components/ui/Badge";
import { api } from "../lib/api";

type Report = {
  id: number;
  name: string;
  description?: string | null;
};

type TelegramUser = {
  id: number;
  username: string;
  telegramId: string | null;
};

type ScheduleFrequency = "DAILY" | "WEEKLY";

type Schedule = {
  id: number;
  hour: number;
  minute: number;
  frequency: ScheduleFrequency;
  weekday: number | null;
  isActive: boolean;
  report?: { id: number; name: string } | null;
  reportName?: string | null;
  recipients: {
    id: number;
    username: string;
    telegramId: string | null;
  }[];
};

type CreateScheduleBody =
  | {
      reportId: number;
      hour: number;
      minute: number;
      frequency: "DAILY";
      recipientIds: number[];
    }
  | {
      reportId: number;
      hour: number;
      minute: number;
      frequency: "WEEKLY";
      weekday: number;
      recipientIds: number[];
    };

type ApiErrorResponse = {
  message?: string;
};

const weekdayLabel = (weekday: number): string => {
  const arr = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
  return arr[weekday] ?? String(weekday);
};

const SchedulesPage: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [users, setUsers] = useState<TelegramUser[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  const [loading, setLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [reportId, setReportId] = useState<string>("");
  const [hour, setHour] = useState<string>("9");
  const [minute, setMinute] = useState<string>("0");
  const [frequency, setFrequency] = useState<ScheduleFrequency>("DAILY");
  const [weekday, setWeekday] = useState<string>("1");
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);

  function getErrorMessage(err: unknown, fallback: string): string {
    if (axios.isAxiosError<ApiErrorResponse>(err)) {
      return err.response?.data?.message ?? err.message ?? fallback;
    }

    if (err instanceof Error) {
      return err.message;
    }

    return fallback;
  }

  const canCreate = useMemo(() => {
    if (!reportId) {
      return false;
    }

    if (!selectedUserIds.length) {
      return false;
    }

    const parsedHour = Number(hour);
    const parsedMinute = Number(minute);

    if (!Number.isFinite(parsedHour) || parsedHour < 0 || parsedHour > 23) {
      return false;
    }

    if (!Number.isFinite(parsedMinute) || parsedMinute < 0 || parsedMinute > 59) {
      return false;
    }

    if (frequency === "WEEKLY") {
      const parsedWeekday = Number(weekday);

      if (!Number.isFinite(parsedWeekday) || parsedWeekday < 0 || parsedWeekday > 6) {
        return false;
      }
    }

    return true;
  }, [reportId, selectedUserIds, hour, minute, frequency, weekday]);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      setLoading(true);
      setError(null);

      try {
        const [reportsRes, usersRes, schedulesRes] = await Promise.all([
          api.get<Report[]>("/api/reports"),
          api.get<TelegramUser[]>("/api/users/telegram"),
          api.get<Schedule[]>("/api/schedules"),
        ]);

        if (cancelled) {
          return;
        }

        setReports(reportsRes.data);
        setUsers(usersRes.data);
        setSchedules(schedulesRes.data);

        if (reportsRes.data.length > 0) {
          setReportId((prev) => prev || String(reportsRes.data[0].id));
        }
      } catch (err: unknown) {
        console.error("load schedules page error", err);

        if (!cancelled) {
          setError(getErrorMessage(err, "Ошибка загрузки данных"));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  function toggleUser(userId: number): void {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  async function handleCreateSchedule(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setFormLoading(true);
    setError(null);

    try {
      if (!canCreate) {
        throw new Error("Проверьте поля формы (время, отчёт, получатели)");
      }

      const base = {
        reportId: Number(reportId),
        hour: Number(hour),
        minute: Number(minute),
        recipientIds: selectedUserIds,
      };

      const body: CreateScheduleBody =
        frequency === "WEEKLY"
          ? {
              ...base,
              frequency: "WEEKLY",
              weekday: Number(weekday),
            }
          : {
              ...base,
              frequency: "DAILY",
            };

      const res = await api.post<Schedule>("/api/schedules", body);

      setSchedules((prev) => [...prev, res.data]);

      setHour("9");
      setMinute("0");
      setFrequency("DAILY");
      setWeekday("1");
      setSelectedUserIds([]);
    } catch (err: unknown) {
      console.error("create schedule error", err);
      setError(getErrorMessage(err, "Ошибка создания расписания"));
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDeleteSchedule(id: number): Promise<void> {
    const confirmed = window.confirm("Удалить расписание?");
    if (!confirmed) {
      return;
    }

    setDeletingId(id);
    setError(null);

    try {
      await api.delete(`/api/schedules/${id}`);
      setSchedules((prev) => prev.filter((schedule) => schedule.id !== id));
    } catch (err: unknown) {
      console.error("delete schedule error", err);
      setError(getErrorMessage(err, "Ошибка удаления расписания"));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Расписания"
        description="Настройка автоматической рассылки отчётов в Telegram. Для WEEKLY указываем день недели."
      />

      {error ? (
        <div className="badge badge-danger" style={{ display: "inline-flex", marginBottom: 12 }}>
          {error}
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)",
          gap: 16,
        }}
      >
        <Card>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 14 }}>Создать расписание</div>
            <span className="muted" style={{ fontSize: 12 }}>
              {loading
                ? "Загрузка справочников…"
                : `${reports.length} отчётов · ${users.length} пользователей`}
            </span>
          </div>

          <form
            onSubmit={(e) => {
              void handleCreateSchedule(e);
            }}
            style={{ display: "grid", gap: 12, marginTop: 14 }}
          >
            <label className="label">
              Отчёт
              <select
                className="select"
                value={reportId}
                onChange={(e) => setReportId(e.target.value)}
              >
                <option value="">— выберите отчёт —</option>
                {reports.map((report) => (
                  <option key={report.id} value={report.id}>
                    {report.name}
                  </option>
                ))}
              </select>
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label className="label">
                Время (час)
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={23}
                  value={hour}
                  onChange={(e) => setHour(e.target.value)}
                />
              </label>

              <label className="label">
                Время (минута)
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={59}
                  value={minute}
                  onChange={(e) => setMinute(e.target.value)}
                />
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label className="label">
                Частота
                <select
                  className="select"
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as ScheduleFrequency)}
                >
                  <option value="DAILY">Ежедневно</option>
                  <option value="WEEKLY">Еженедельно</option>
                </select>
              </label>

              <label className="label">
                День недели (для WEEKLY)
                <select
                  className="select"
                  value={weekday}
                  onChange={(e) => setWeekday(e.target.value)}
                  disabled={frequency !== "WEEKLY"}
                >
                  <option value="0">воскресенье</option>
                  <option value="1">понедельник</option>
                  <option value="2">вторник</option>
                  <option value="3">среда</option>
                  <option value="4">четверг</option>
                  <option value="5">пятница</option>
                  <option value="6">суббота</option>
                </select>
              </label>
            </div>

            <div>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>
                Получатели (Telegram)
              </div>

              <div
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: 10,
                  background: "var(--surface)",
                  maxHeight: 220,
                  overflow: "auto",
                }}
              >
                {users.length === 0 ? (
                  <div className="muted" style={{ fontSize: 13 }}>
                    Нет пользователей с привязанным Telegram.
                  </div>
                ) : (
                  users.map((user) => {
                    const checked = selectedUserIds.includes(user.id);

                    return (
                      <label
                        key={user.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10,
                          padding: "8px 8px",
                          borderRadius: 12,
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleUser(user.id)}
                          />
                          <div style={{ display: "grid" }}>
                            <div style={{ fontWeight: 800, fontSize: 13 }}>{user.username}</div>
                            <div className="muted" style={{ fontSize: 12 }}>
                              {user.telegramId
                                ? `telegram_id: ${user.telegramId}`
                                : "telegram_id не привязан"}
                            </div>
                          </div>
                        </div>

                        {checked ? (
                          <Badge tone="success">выбран</Badge>
                        ) : (
                          <Badge tone="neutral">—</Badge>
                        )}
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Button type="submit" disabled={formLoading || loading || !canCreate}>
                {formLoading ? "Создание…" : "Создать"}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={() => setSelectedUserIds([])}
                disabled={!selectedUserIds.length}
              >
                Сбросить получателей
              </Button>
            </div>
          </form>
        </Card>

        <Card>
          <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 8 }}>
            Подсказка для демонстрации
          </div>

          <div className="muted" style={{ fontSize: 13, lineHeight: 1.55 }}>
            Бот периодически вызывает backend эндпоинт <b>/api/schedules/run-due</b> и забирает
            «готовые к отправке» расписания. Дедупликация делается через таблицу{" "}
            <b>delivery_logs</b>, чтобы не отправлять один и тот же отчёт дважды в одну минуту.
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            <div className="badge" style={{ justifyContent: "center" }}>
              DAILY — каждый день в указанное время
            </div>
            <div className="badge" style={{ justifyContent: "center" }}>
              WEEKLY — в выбранный день недели (0=вс … 6=сб)
            </div>
          </div>
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card padded={false}>
          <div
            style={{
              padding: 16,
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 14 }}>Существующие расписания</div>
            <span className="muted" style={{ fontSize: 12 }}>
              {schedules.length ? `${schedules.length} шт.` : "—"}
            </span>
          </div>

          {loading ? (
            <div style={{ padding: 16 }} className="muted">
              Загрузка…
            </div>
          ) : schedules.length === 0 ? (
            <div style={{ padding: 16 }} className="muted">
              Пока расписаний нет. Создайте первое сверху.
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Отчёт</th>
                  <th>Время</th>
                  <th>Частота</th>
                  <th>Получатели</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((schedule) => (
                  <tr key={schedule.id}>
                    <td>{schedule.id}</td>
                    <td>{schedule.report?.name ?? schedule.reportName ?? "—"}</td>
                    <td>
                      {String(schedule.hour).padStart(2, "0")}:
                      {String(schedule.minute).padStart(2, "0")}
                    </td>
                    <td>
                      {schedule.frequency === "DAILY" ? (
                        <Badge tone="neutral">DAILY</Badge>
                      ) : (
                        <Badge tone="warning">
                          WEEKLY ·{" "}
                          {schedule.weekday != null ? weekdayLabel(schedule.weekday) : "?"}
                        </Badge>
                      )}
                    </td>
                    <td style={{ maxWidth: 360 }}>
                      {schedule.recipients.length
                        ? schedule.recipients.map((recipient) => recipient.username).join(", ")
                        : "—"}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <Button
                        variant="danger"
                        onClick={() => {
                          void handleDeleteSchedule(schedule.id);
                        }}
                        disabled={deletingId === schedule.id}
                      >
                        {deletingId === schedule.id ? "Удаление…" : "Удалить"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
};

export default SchedulesPage;