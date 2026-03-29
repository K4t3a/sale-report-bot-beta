import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import type { ReactNode } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Card from "./ui/Card";
import { api } from "../lib/api";

type SalesPoint = {
  date: string;
  totalRevenue: number;
  totalOrders: number;
  totalQuantity: number;
};

type AnalyticsResponse = {
  from: string;
  to: string;
  days: number;
  points: SalesPoint[];
};

type ApiErrorResponse = {
  message?: string;
};

type SalesRevenueChartProps = {
  days: number;
};

type ChartPoint = {
  date: string;
  shortDate: string;
  revenue: number;
};

const formatAxisMoney = (value: number | string): string => {
  const num = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(num)) {
    return "0";
  }

  if (num >= 1_000_000) {
    return `${Math.round(num / 1_000_000)}m`;
  }

  if (num >= 1_000) {
    return `${Math.round(num / 1_000)}k`;
  }

  return String(Math.round(num));
};

const formatTooltipMoney = (value: number): string => {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);
};

const formatShortDate = (isoDate: string): string => {
  const parsed = new Date(isoDate);

  if (Number.isNaN(parsed.getTime())) {
    return isoDate;
  }

  return parsed.toISOString().slice(0, 10);
};

const SalesRevenueChart: React.FC<SalesRevenueChartProps> = ({ days }) => {
  const [data, setData] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);
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
        const res = await api.get<AnalyticsResponse>("/api/analytics/sales-by-day", {
          params: { days },
        });

        if (cancelled) {
          return;
        }

        const mapped: ChartPoint[] = res.data.points.map((point) => ({
          date: point.date,
          shortDate: formatShortDate(point.date),
          revenue: point.totalRevenue,
        }));

        setData(mapped);
      } catch (err: unknown) {
        console.error("sales revenue chart error", err);

        if (!cancelled) {
          setError(getErrorMessage(err, "Ошибка загрузки графика"));
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
  }, [days]);

  const title = useMemo(() => {
    if (days === 1) {
      return "Выручка по дням (последний 1 дн.)";
    }

    return `Выручка по дням (последние ${days} дн.)`;
  }, [days]);

  return (
    <Card>
      <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 12 }}>{title}</div>

      {loading ? (
        <div className="muted">Загрузка...</div>
      ) : error ? (
        <div style={{ color: "red" }}>Ошибка: {error}</div>
      ) : data.length === 0 ? (
        <div className="muted">Нет данных для отображения</div>
      ) : (
        <div style={{ width: "100%", height: 420 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(15, 23, 42, 0.18)" />
              <XAxis
                dataKey="shortDate"
                tick={{ fontSize: 11, fill: "rgba(15, 23, 42, 0.65)" }}
                axisLine={{ stroke: "rgba(15, 23, 42, 0.35)" }}
                tickLine={{ stroke: "rgba(15, 23, 42, 0.25)" }}
              />
              <YAxis
                tickFormatter={formatAxisMoney}
                tick={{ fontSize: 12, fill: "rgba(15, 23, 42, 0.65)" }}
                axisLine={{ stroke: "rgba(15, 23, 42, 0.35)" }}
                tickLine={{ stroke: "rgba(15, 23, 42, 0.25)" }}
                width={56}
              />
              <Tooltip
                formatter={(value: number | string | Array<number | string> | undefined) => {
                  const numericValue =
                    typeof value === "number"
                      ? value
                      : typeof value === "string"
                      ? Number(value)
                      : Array.isArray(value)
                      ? Number(value[0])
                      : 0;

                  return formatTooltipMoney(Number.isFinite(numericValue) ? numericValue : 0);
                }}
                labelFormatter={(label: ReactNode) => `Дата: ${String(label ?? "")}`}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid rgba(15, 23, 42, 0.08)",
                  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
                }}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="var(--primary)"
                strokeWidth={2.5}
                dot={{
                  r: 3.5,
                  strokeWidth: 2,
                  fill: "#ffffff",
                }}
                activeDot={{
                  r: 5,
                  strokeWidth: 2,
                  fill: "#ffffff",
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
};

export default SalesRevenueChart;