import React, { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Point = {
  date: string; // YYYY-MM-DD
  totalRevenue: number;
  totalOrders: number;
  totalQuantity: number;
};

type ApiResponse = {
  from: string;
  to: string;
  days: number;
  points: Point[];
};

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

interface Props {
  days?: number;
}

/**
 * Безопасное преобразование значения к числу.
 * Recharts может прокидывать number | string | undefined.
 */
function toNumber(value: number | string | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function formatMoney(value: number): string {
  // Для короткого вида: 12 345
  return value.toLocaleString("ru-RU");
}

function formatYAxisTick(val: number): string {
  if (val >= 1_000_000) return `${Math.round(val / 1_000_000)}m`;
  if (val >= 1_000) return `${Math.round(val / 1_000)}k`;
  return String(val);
}

/**
 * Типы Tooltip в recharts не всегда корректны под strict TS.
 * Поэтому типизируем пропсы руками (ровно то, что нам нужно).
 */
type CustomTooltipProps = {
  active?: boolean;
  label?: string | number;
  payload?: Array<{
    value?: number | string;
    dataKey?: string;
    name?: string;
  }>;
};

const CustomTooltip: React.FC<CustomTooltipProps> = ({
  active,
  label,
  payload,
}) => {
  if (!active || !payload || payload.length === 0) return null;

  const raw = payload[0]?.value;
  const revenue = toNumber(raw);

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid rgba(15, 23, 42, 0.10)",
        borderRadius: 12,
        padding: "10px 12px",
        boxShadow: "0 12px 30px rgba(15, 23, 42, 0.10)",
        fontSize: 12,
        minWidth: 180,
      }}
    >
      <div style={{ fontWeight: 900, marginBottom: 6 }}>
        Дата: {String(label ?? "")}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <span style={{ color: "rgba(15, 23, 42, 0.70)" }}>Выручка, ₽</span>
        <span style={{ fontWeight: 900 }}>{formatMoney(revenue)}</span>
      </div>
    </div>
  );
};

const SalesRevenueChart: React.FC<Props> = ({ days = 7 }) => {
  const [data, setData] = useState<Point[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const xInterval = useMemo(() => {
    if (data.length <= 10) return 0;
    return Math.max(1, Math.round(data.length / 5));
  }, [data.length]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const resp = await fetch(
          `${API_BASE}/api/analytics/sales-by-day?days=${days}`
        );

        if (!resp.ok) {
          throw new Error(`Ошибка запроса: ${resp.status}`);
        }

        const json = (await resp.json()) as ApiResponse;

        // Небольшая защита: убедимся, что points массив
        const points = Array.isArray(json.points) ? json.points : [];
        setData(points);
      } catch (e: unknown) {
        console.error("sales-by-day fetch error", e);
        setError(e instanceof Error ? e.message : "Не удалось загрузить данные");
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [days]);

  return (
    <div className="card" style={{ padding: 16 }}>
      <div
        style={{
          marginBottom: 8,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 14 }}>
          Выручка по дням (последние {days} дн.)
        </div>
      </div>

      {loading && <div>Загрузка данных…</div>}
      {error && (
        <div style={{ color: "red", marginBottom: 8 }}>Ошибка: {error}</div>
      )}

      {!loading && !error && (
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />

              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                interval={xInterval}
              />

              <YAxis tickFormatter={(v) => formatYAxisTick(v)} />

              {/* Важно: используем кастомный tooltip с ручными типами */}
              <Tooltip content={<CustomTooltip />} />

              <Line
                type="monotone"
                dataKey="totalRevenue"
                dot={{ r: 3 }}
                strokeWidth={2}
                // name влияет на подпись в tooltip/legend, но мы делаем кастомный tooltip
                name="Выручка"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default SalesRevenueChart;
