import React, { useMemo, useState } from "react";
import SalesRevenueChart from "../components/SalesRevenueChart";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import PageHeader from "../components/ui/PageHeader";

type Summary = {
  totalRevenue: number;
  totalOrders: number;
  totalQuantity: number;
  averageCheck: number;
};

interface ReportResponse {
  period: {
    from: string;
    to: string;
  };
  summary: Summary;
  csv: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

const formatMoney = (value: number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);

const formatInt = (value: number) => new Intl.NumberFormat("ru-RU").format(value);

const Metric: React.FC<{
  label: string;
  value: string;
  hint?: string;
}> = ({ label, value, hint }) => {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, marginTop: 6 }}>{value}</div>
      {hint ? <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>{hint}</div> : null}
    </div>
  );
};

const Dashboard: React.FC = () => {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [csv, setCsv] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const quickPeriod = useMemo(() => ({ period: "today" }), []);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/reports/daily-sales`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(quickPeriod),
      });

      const json = (await res.json().catch(() => null)) as ReportResponse | null;
      if (!res.ok || !json) {
        const message =
          json &&
          typeof json === "object" && "message" in json && 
          typeof (json as { message: unknown }).message === "string"
          ? (json as { message: string }).message
          : `Ошибка запроса: ${res.status}`;

        throw new Error(message);
      }

      setSummary(json.summary);
      setCsv(json.csv);
    } catch (e: unknown) {
      console.error("daily-sales error", e);
      setError(e instanceof Error ? e.message : "Не удалось сформировать отчёт");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!csv) return;

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sales-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        title="Отчёты"
        description="Быстрая генерация отчёта и обзор динамики выручки. Данные берутся из PostgreSQL и агрегируются на сервере."
        right={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button onClick={handleGenerate} disabled={loading}>
              {loading ? "Генерация…" : "Сформировать отчёт"}
            </Button>
            <Button variant="ghost" onClick={handleDownload} disabled={!csv}>
              Скачать CSV
            </Button>
          </div>
        }
      />

      {error ? (
        <div className="badge badge-danger" style={{ display: "inline-flex", marginBottom: 12 }}>
          {error}
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.8fr) minmax(0, 1fr)", gap: 16 }}>
        <SalesRevenueChart days={14} />

        <Card>
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ fontWeight: 900, fontSize: 14 }}>Сводка за период</div>
            <div className="muted" style={{ fontSize: 13 }}>
              Нажмите «Сформировать отчёт» — и появятся показатели за сегодня.
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: 10,
                marginTop: 8,
              }}
            >
              <Metric
                label="Выручка"
                value={summary ? formatMoney(summary.totalRevenue) : "—"}
                hint="Сумма price × quantity"
              />
              <Metric
                label="Заказы"
                value={summary ? formatInt(summary.totalOrders) : "—"}
                hint="Количество строк продаж"
              />
              <Metric
                label="Единицы"
                value={summary ? formatInt(summary.totalQuantity) : "—"}
                hint="Сумма quantity"
              />
              <Metric
                label="Средний чек"
                value={summary ? formatMoney(summary.averageCheck) : "—"}
                hint="Выручка / заказы"
              />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
