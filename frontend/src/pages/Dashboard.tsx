import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";
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

type ReportPeriodKey = "today" | "last7days" | "last30days";

interface ReportResponse {
  period: {
    from: string;
    to: string;
  };
  summary: Summary;
  csv: string;
}

type ErrorResponse = {
  message?: string;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

// Форматирование денежного значения для карточек и сводки.
const formatMoney = (value: number): string =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);

// Форматирование целых чисел без дробной части.
const formatInt = (value: number): string => new Intl.NumberFormat("ru-RU").format(value);

// Небольшой локальный компонент для отображения KPI.
// Используем его для выручки, заказов, количества и среднего чека.
const Metric: React.FC<{
  label: string;
  value: string;
  hint?: string;
}> = ({ label, value, hint }) => {
  return (
    <Card>
      <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 900, marginTop: 8 }}>{value}</div>
      {hint ? (
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>{hint}</div>
      ) : null}
    </Card>
  );
};

const Dashboard: React.FC = () => {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [csv, setCsv] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriodKey>("today");

// Вычисляем метаданные выбранного периода.
// Это позволяет в одном месте менять подписи, число дней на графике и имя файла.
  const currentPeriodMeta = useMemo(() => {
    if (selectedPeriod === "today") {
      return {
        label: "День",
        chartDays: 1,
        buttonTitle: "Сформировать отчёт за день",
        hintText: "Нажмите «Сформировать отчёт» — и появятся показатели за сегодня.",
        fileSuffix: "day",
      };
    }

    if (selectedPeriod === "last7days") {
      return {
        label: "Неделя",
        chartDays: 7,
        buttonTitle: "Сформировать отчёт за неделю",
        hintText: "Нажмите «Сформировать отчёт» — и появятся показатели за последние 7 дней.",
        fileSuffix: "week",
      };
    }

    return {
      label: "Месяц",
      chartDays: 30,
      buttonTitle: "Сформировать отчёт за месяц",
      hintText: "Нажмите «Сформировать отчёт» — и появятся показатели за последние 30 дней.",
      fileSuffix: "month",
    };
  }, [selectedPeriod]);

// Запрашиваем генерацию отчёта на backend.
// После успешного ответа сохраняем summary и CSV в state.
  const handleGenerate = async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("authToken");

      const res = await fetch(`${API_BASE_URL}/api/reports/daily-sales`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ period: selectedPeriod }),
      });

      const json = (await res.json().catch(() => null)) as ReportResponse | ErrorResponse | null;

      if (!res.ok || !json || !("summary" in json)) {
        const message =
          json &&
          typeof json === "object" &&
          "message" in json &&
          typeof json.message === "string"
            ? json.message
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

// Выгрузка CSV.
// Добавляем BOM, чтобы Excel корректно открывал кириллицу.
  const handleDownloadCsv = (): void => {
    if (!csv) {
      return;
    }

    const csvWithBom = `\uFEFF${csv}`;
    const blob = new Blob([csvWithBom], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `sales-report-${currentPeriodMeta.fileSuffix}-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  };

// Выгрузка XLSX на основе уже сформированного CSV.
// Дополнительно подстраиваем ширину колонок для читаемости файла.
  const handleDownloadXlsx = (): void => {
    if (!csv) {
      return;
    }

    try {
      const csvWithBom = `\uFEFF${csv}`;

      const workbook = XLSX.read(csvWithBom, {
        type: "string",
        raw: false,
      });

      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName) {
        throw new Error("Не удалось создать лист XLSX");
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const range = XLSX.utils.decode_range(worksheet["!ref"] ?? "A1:A1");
      const columnWidths: Array<{ wch: number }> = [];

      for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
        let maxLength = 12;

        for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex += 1) {
          const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
          const cell = worksheet[cellAddress];

          if (!cell || cell.v == null) {
            continue;
          }

          maxLength = Math.max(maxLength, String(cell.v).length + 2);
        }

        columnWidths.push({ wch: Math.min(maxLength, 40) });
      }

      worksheet["!cols"] = columnWidths;

      XLSX.writeFile(
        workbook,
        `sales-report-${currentPeriodMeta.fileSuffix}-${new Date()
          .toISOString()
          .slice(0, 10)}.xlsx`
      );
    } catch (e: unknown) {
      console.error("xlsx export error", e);
      setError(e instanceof Error ? e.message : "Не удалось выгрузить XLSX");
    }
  };

  return (
    <div>
      <PageHeader
        title="Отчёты"
        description="Быстрая генерация отчёта и обзор динамики выручки. Данные берутся из PostgreSQL и агрегируются на сервере."
        right={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button onClick={handleGenerate} disabled={loading}>
              {loading ? "Генерация…" : currentPeriodMeta.buttonTitle}
            </Button>
            <Button variant="ghost" onClick={handleDownloadCsv} disabled={!csv}>
              Скачать CSV
            </Button>
            <Button variant="ghost" onClick={handleDownloadXlsx} disabled={!csv}>
              Скачать XLSX
            </Button>
          </div>
        }
      />

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <Button
          variant={selectedPeriod === "today" ? "primary" : "ghost"}
          onClick={() => setSelectedPeriod("today")}
        >
          День
        </Button>
        <Button
          variant={selectedPeriod === "last7days" ? "primary" : "ghost"}
          onClick={() => setSelectedPeriod("last7days")}
        >
          Неделя
        </Button>
        <Button
          variant={selectedPeriod === "last30days" ? "primary" : "ghost"}
          onClick={() => setSelectedPeriod("last30days")}
        >
          Месяц
        </Button>
      </div>

      {error ? (
        <div className="badge badge-danger" style={{ display: "inline-flex", marginBottom: 12 }}>
          {error}
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 16 }}>
        <SalesRevenueChart days={currentPeriodMeta.chartDays} />

        <Card>
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ fontWeight: 900, fontSize: 14 }}>
              Сводка за период: {currentPeriodMeta.label}
            </div>

            <div className="muted" style={{ fontSize: 13 }}>
              {currentPeriodMeta.hintText}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 12,
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