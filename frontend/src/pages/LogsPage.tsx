import React, { useEffect, useState } from "react";
import axios from "axios";
import Card from "../components/ui/Card";
import PageHeader from "../components/ui/PageHeader";
import Badge from "../components/ui/Badge";
import { api } from "../lib/api";

type LogItem = {
  id: number;
  sentAt: string;
  status: string;
  error: string | null;
  reportId: number | null;
  reportName: string | null;
  userId: number | null;
  username: string | null;
  scheduleId: number | null;
};

type ApiErrorResponse = {
  message?: string;
};

const LogsPage: React.FC = () => {
  const [items, setItems] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function getErrorMessage(err: unknown, fallback: string): string {
    if (axios.isAxiosError<ApiErrorResponse>(err)) {
      return err.response?.data?.message ?? err.message ?? fallback;
    }

    if (err instanceof Error) {
      return err.message;
    }

    return fallback;
  }

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      setLoading(true);
      setError(null);

      try {
        const res = await api.get<LogItem[]>("/api/logs", {
          params: { limit: 200 },
        });

        if (!cancelled) {
          setItems(res.data);
        }
      } catch (err: unknown) {
        console.error("logs load error", err);

        if (!cancelled) {
          setError(getErrorMessage(err, "Ошибка загрузки логов"));
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

  const formatDateTime = (value: string): string => {
    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return parsed.toLocaleString("ru-RU");
  };

  const renderStatus = (status: string): React.ReactNode => {
    const normalized = status.toUpperCase();

    if (normalized === "SUCCESS" || normalized === "SENT" || normalized === "OK") {
      return <Badge tone="success">{status}</Badge>;
    }

    if (normalized === "ERROR" || normalized === "FAILED") {
      return <Badge tone="danger">{status}</Badge>;
    }

    return <Badge tone="neutral">{status}</Badge>;
  };

  return (
    <div>
      <PageHeader
        title="Логи"
        description="История отправки отчётов, статусы доставки и возможные ошибки при выполнении рассылки."
      />

      {error ? (
        <div className="badge badge-danger" style={{ display: "inline-flex", marginBottom: 12 }}>
          {error}
        </div>
      ) : null}

      <Card padded={false}>
        <div
          style={{
            padding: 16,
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 14 }}>Журнал доставки</div>
          <span className="muted" style={{ fontSize: 12 }}>
            {loading ? "Загрузка…" : items.length ? `${items.length} записей` : "—"}
          </span>
        </div>

        {loading ? (
          <div style={{ padding: 16 }} className="muted">
            Загрузка…
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: 16 }} className="muted">
            Логи пока отсутствуют.
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Дата и время</th>
                <th>Отчёт</th>
                <th>Пользователь</th>
                <th>Статус</th>
                <th>Ошибка</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{formatDateTime(item.sentAt)}</td>
                  <td>{item.reportName ?? "—"}</td>
                  <td>{item.username ?? "—"}</td>
                  <td>{renderStatus(item.status)}</td>
                  <td style={{ maxWidth: 360, whiteSpace: "pre-wrap" }}>
                    {item.error ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
};

export default LogsPage;