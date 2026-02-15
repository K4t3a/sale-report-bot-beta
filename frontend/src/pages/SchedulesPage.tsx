import React, { useEffect, useMemo, useState } from "react";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import PageHeader from "../components/ui/PageHeader";
import Badge from "../components/ui/Badge";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

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

const weekdayLabel = (w: number) => {
  const arr = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
  return arr[w] ?? String(w);
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
  const [weekday, setWeekday] = useState<string>("1"); // понедельник
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);

  const canCreate = useMemo(() => {
    if (!reportId) return false;
    if (!selectedUserIds.length) return false;
    const h = Number(hour);
    const m = Number(minute);
    if (!Number.isFinite(h) || h < 0 || h > 23) return false;
    if (!Number.isFinite(m) || m < 0 || m > 59) return false;
    if (frequency === "WEEKLY") {
      const wd = Number(weekday);
      if (!Number.isFinite(wd) || wd < 0 || wd > 6) return false;
    }
    return true;
  }, [reportId, selectedUserIds, hour, minute, frequency, weekday]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [reportsRes, usersRes, schedulesRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/reports`),
          fetch(`${API_BASE_URL}/api/users/telegram`),
          fetch(`${API_BASE_URL}/api/schedules`),
        ]);

        if (!reportsRes.ok || !usersRes.ok || !schedulesRes.ok) {
          throw new Error("Ошибка загрузки данных");
        }

        const [reportsData, usersData, schedulesData] = await Promise.all([
          reportsRes.json(),
          usersRes.json(),
          schedulesRes.json(),
        ]);

        setReports(reportsData);
        setUsers(usersData);
        setSchedules(schedulesData);

        if (reportsData.length > 0) {
          setReportId(String(reportsData[0].id));
        }
      } catch (e) {
        console.error("load schedules page error", e);
        setError(e instanceof Error ? e.message : "Неизвестная ошибка");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const toggleUser = (userId: number) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setError(null);

    try {
      if (!canCreate) throw new Error("Проверьте поля формы (время, отчёт, получатели)");

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
      weekday: number; // 0..6
      recipientIds: number[];
    };

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

      const res = await fetch(`${API_BASE_URL}/api/schedules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.message ?? `Ошибка создания расписания: ${res.status}`);
      }

      setSchedules((prev) => [...prev, data as Schedule]);

      // reset частично (получателей сбрасываем, чтобы случайно не клепать одинаковые задачи)
      setHour("9");
      setMinute("0");
      setFrequency("DAILY");
      setWeekday("1");
      setSelectedUserIds([]);
    } catch (e) {
      console.error("create schedule error", e);
      setError(e instanceof Error ? e.message : "Неизвестная ошибка");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteSchedule = async (id: number) => {
    if (!window.confirm("Удалить расписание?")) return;

    setDeletingId(id);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/schedules/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Ошибка удаления: ${res.status} ${text || ""}`);
      }

      setSchedules((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      console.error("delete schedule error", e);
      setError(e instanceof Error ? e.message : "Неизвестная ошибка");
    } finally {
      setDeletingId(null);
    }
  };

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

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)", gap: 16 }}>
        <Card>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <div style={{ fontWeight: 900, fontSize: 14 }}>Создать расписание</div>
            <span className="muted" style={{ fontSize: 12 }}>
              {loading ? "Загрузка справочников…" : `${reports.length} отчётов · ${users.length} пользователей`}
            </span>
          </div>

          <form onSubmit={handleCreateSchedule} style={{ display: "grid", gap: 12, marginTop: 14 }}>
            <label className="label">
              Отчёт
              <select className="select" value={reportId} onChange={(e) => setReportId(e.target.value)}>
                <option value="">— выберите отчёт —</option>
                {reports.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
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
                  users.map((u) => {
                    const checked = selectedUserIds.includes(u.id);
                    return (
                      <label
                        key={u.id}
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
                          <input type="checkbox" checked={checked} onChange={() => toggleUser(u.id)} />
                          <div style={{ display: "grid" }}>
                            <div style={{ fontWeight: 800, fontSize: 13 }}>{u.username}</div>
                            <div className="muted" style={{ fontSize: 12 }}>
                              {u.telegramId ? `telegram_id: ${u.telegramId}` : "telegram_id не привязан"}
                            </div>
                          </div>
                        </div>
                        {checked ? <Badge tone="success">выбран</Badge> : <Badge tone="neutral">—</Badge>}
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
          <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 8 }}>Подсказка для демонстрации</div>
          <div className="muted" style={{ fontSize: 13, lineHeight: 1.55 }}>
            Бот периодически вызывает backend эндпоинт <b>/api/schedules/run-due</b> и забирает «готовые к отправке»
            расписания. Дедупликация делается через таблицу <b>delivery_logs</b> (чтобы не слать один и тот же отчёт
            дважды в одну минуту).
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
          <div style={{ padding: 16, display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
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
                {schedules.map((s) => (
                  <tr key={s.id}>
                    <td>{s.id}</td>
                    <td>{s.report?.name ?? s.reportName ?? "—"}</td>
                    <td>
                      {String(s.hour).padStart(2, "0")}:{String(s.minute).padStart(2, "0")}
                    </td>
                    <td>
                      {s.frequency === "DAILY" ? (
                        <Badge tone="neutral">DAILY</Badge>
                      ) : (
                        <Badge tone="warning">WEEKLY · {s.weekday != null ? weekdayLabel(s.weekday) : "?"}</Badge>
                      )}
                    </td>
                    <td style={{ maxWidth: 360 }}>
                      {s.recipients.length ? s.recipients.map((r) => r.username).join(", ") : "—"}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <Button
                        variant="danger"
                        onClick={() => handleDeleteSchedule(s.id)}
                        disabled={deletingId === s.id}
                      >
                        {deletingId === s.id ? "Удаление…" : "Удалить"}
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
