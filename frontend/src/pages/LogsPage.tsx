import React, { useEffect, useMemo, useState } from "react";

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

type DeliveryLogRow = {
  id: number;
  sentAt: string;
  status: "SUCCESS" | "ERROR" | string;
  error: string | null;
  reportId: number | null;
  reportName: string | null;
  userId: number | null;
  username: string | null;
  scheduleId: number | null;
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ru-RU");
}

function statusColor(status: string): string {
  if (status === "SUCCESS") return "#16a34a";
  if (status === "ERROR") return "#dc2626";
  return "#4b5563";
}

const LogsPage: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [users, setUsers] = useState<TelegramUser[]>([]);
  const [logs, setLogs] = useState<DeliveryLogRow[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filterReportId, setFilterReportId] = useState<string>("");
  const [filterUserId, setFilterUserId] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const qs = new URLSearchParams();
        qs.set("limit", "200"); // чтобы было что фильтровать локально

        const [reportsRes, usersRes, logsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/reports`),
          fetch(`${API_BASE_URL}/api/users/telegram`),
          fetch(`${API_BASE_URL}/api/logs?${qs.toString()}`),
        ]);

        if (!reportsRes.ok) throw new Error(`Не удалось загрузить отчёты (${reportsRes.status})`);
        if (!usersRes.ok) throw new Error(`Не удалось загрузить пользователей (${usersRes.status})`);
        if (!logsRes.ok) throw new Error(`Не удалось загрузить логи (${logsRes.status})`);

        const [reportsData, usersData, logsData] = (await Promise.all([
          reportsRes.json(),
          usersRes.json(),
          logsRes.json(),
        ])) as [Report[], TelegramUser[], DeliveryLogRow[]];

        setReports(reportsData);
        setUsers(usersData);
        setLogs(logsData);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Неизвестная ошибка");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const filteredLogs = useMemo(() => {
    const rid = filterReportId ? Number(filterReportId) : null;
    const uid = filterUserId ? Number(filterUserId) : null;

    return logs.filter((l) => {
      if (rid && l.reportId !== rid) return false;
      if (uid && l.userId !== uid) return false;
      return true;
    });
  }, [logs, filterReportId, filterUserId]);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.55)" }}>Панель управления</div>
        <h1 style={{ fontSize: 22, margin: "6px 0 0" }}>Логи отправки</h1>
      </div>

      {error && (
        <div
          style={{
            background: "rgba(239, 68, 68, 0.08)",
            color: "#991b1b",
            padding: "10px 12px",
            marginBottom: 14,
            borderRadius: 10,
            border: "1px solid rgba(239, 68, 68, 0.18)",
          }}
        >
          {error}
        </div>
      )}

      {/* Filters */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 14,
          alignItems: "flex-end",
          flexWrap: "wrap",
        }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.55)" }}>Отчёт</span>
          <select
            value={filterReportId}
            onChange={(e) => setFilterReportId(e.target.value)}
            style={{
              height: 38,
              padding: "0 10px",
              borderRadius: 10,
              border: "1px solid rgba(15, 23, 42, 0.10)",
              background: "#fff",
              minWidth: 220,
            }}
          >
            <option value="">Все</option>
            {reports.map((r) => (
              <option key={r.id} value={String(r.id)}>
                {r.name}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.55)" }}>Пользователь</span>
          <select
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
            style={{
              height: 38,
              padding: "0 10px",
              borderRadius: 10,
              border: "1px solid rgba(15, 23, 42, 0.10)",
              background: "#fff",
              minWidth: 260,
            }}
          >
            <option value="">Все</option>
            {users.map((u) => (
              <option key={u.id} value={String(u.id)}>
                {u.username}
                {u.telegramId ? ` (${u.telegramId})` : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <div style={{ color: "rgba(15, 23, 42, 0.65)" }}>Загрузка…</div>
      ) : filteredLogs.length === 0 ? (
        <div style={{ color: "rgba(15, 23, 42, 0.65)" }}>Логов нет.</div>
      ) : (
        <div
          style={{
            background: "#fff",
            border: "1px solid rgba(15, 23, 42, 0.08)",
            borderRadius: 14,
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "rgba(15, 23, 42, 0.02)" }}>
                <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid rgba(15,23,42,0.08)" }}>
                  Время
                </th>
                <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid rgba(15,23,42,0.08)" }}>
                  Отчёт
                </th>
                <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid rgba(15,23,42,0.08)" }}>
                  Пользователь
                </th>
                <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid rgba(15,23,42,0.08)" }}>
                  Статус
                </th>
                <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid rgba(15,23,42,0.08)" }}>
                  Ошибка
                </th>
                <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid rgba(15,23,42,0.08)" }}>
                  Schedule
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id}>
                  <td style={{ padding: 12, borderBottom: "1px solid rgba(15,23,42,0.06)", whiteSpace: "nowrap" }}>
                    {formatDateTime(log.sentAt)}
                  </td>

                  <td style={{ padding: 12, borderBottom: "1px solid rgba(15,23,42,0.06)" }}>
                    {log.reportName ?? (log.reportId ? `#${log.reportId}` : "—")}
                  </td>

                  <td style={{ padding: 12, borderBottom: "1px solid rgba(15,23,42,0.06)" }}>
                    {log.username ?? (log.userId ? `#${log.userId}` : "—")}
                  </td>

                  <td
                    style={{
                      padding: 12,
                      borderBottom: "1px solid rgba(15,23,42,0.06)",
                      color: statusColor(log.status),
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {log.status}
                  </td>

                  <td
                    style={{
                      padding: 12,
                      borderBottom: "1px solid rgba(15,23,42,0.06)",
                      maxWidth: 380,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      color: "rgba(15, 23, 42, 0.75)",
                    }}
                    title={log.error ?? ""}
                  >
                    {log.error ?? "—"}
                  </td>

                  <td style={{ padding: 12, borderBottom: "1px solid rgba(15,23,42,0.06)", whiteSpace: "nowrap" }}>
                    {log.scheduleId ? `#${log.scheduleId}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default LogsPage;