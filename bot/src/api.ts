import axios from "axios";

const backendBaseUrl = process.env.BACKEND_BASE_URL ?? "http://localhost:4000";
const serviceToken = process.env.SERVICE_TOKEN ?? "dev-service-token";

const internalApi = axios.create({
  baseURL: backendBaseUrl,
  timeout: 15000,
  headers: {
    "x-service-token": serviceToken,
  },
});

export interface TelegramBoundUser {
  id: number;
  username: string;
  role: "ADMIN" | "ANALYST" | "VIEWER";
  isActive: boolean;
  telegramId: string | null;
}

export interface SalesReportSummary {
  totalRevenue: number;
  totalOrders: number;
  totalQuantity: number;
  averageCheck: number;
}

export interface SalesReportResponse {
  period: {
    from: string;
    to: string;
  };
  summary: SalesReportSummary;
  csv: string;
}

export interface DueRecipientDto {
  userId: number;
  telegramId: string;
}

export interface DueScheduleDto {
  scheduleId: number;
  reportId: number;
  reportName: string;
  summary: SalesReportSummary;
  csv: string;
  recipients: DueRecipientDto[];
}

export interface ReportInfo {
  id: number;
  name: string;
  description?: string | null;
  periodType?: string;
}

export interface RunReportResponse {
  reportName: string;
  summary: SalesReportSummary;
  csv: string;
}

export async function fetchTelegramMe(
  telegramId: string
): Promise<TelegramBoundUser | null> {
  const response = await fetch(`${backendBaseUrl}/api/telegram/me/${telegramId}`);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch telegram user: ${response.status}`);
  }

  const data = (await response.json()) as { user: TelegramBoundUser };
  return data.user;
}

export async function bindTelegramAccount(params: {
  code: string;
  telegramId: string;
  telegramUsername?: string | null;
  telegramFirstName?: string | null;
  telegramLastName?: string | null;
}) {
  const response = await fetch(`${backendBaseUrl}/api/telegram/bind`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  const data = (await response.json().catch(() => null)) as
    | {
        message?: string;
        user?: {
          id: number;
          username: string;
          role: "ADMIN" | "ANALYST" | "VIEWER";
        };
      }
    | null;

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

export async function unbindTelegramAccount(telegramId: string) {
  const response = await fetch(`${backendBaseUrl}/api/telegram/unbind`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ telegramId }),
  });

  const data = (await response.json().catch(() => null)) as
    | {
        message?: string;
        user?: {
          id: number;
          username: string;
          role: "ADMIN" | "ANALYST" | "VIEWER";
        };
      }
    | null;

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

export async function fetchSalesReportByPeriod(
  period: "today" | "last7days" | "last30days"
): Promise<SalesReportResponse> {
  const res = await internalApi.post("/api/reports/daily-sales", { period });
  return res.data as SalesReportResponse;
}

export async function fetchTodaySalesReport(): Promise<SalesReportResponse> {
  return fetchSalesReportByPeriod("today");
}

export async function fetchWeekSalesReport(): Promise<SalesReportResponse> {
  return fetchSalesReportByPeriod("last7days");
}

export async function fetchMonthSalesReport(): Promise<SalesReportResponse> {
  return fetchSalesReportByPeriod("last30days");
}

export async function fetchDueSchedules(): Promise<DueScheduleDto[]> {
  const res = await internalApi.post("/api/schedules/run-due");
  return res.data as DueScheduleDto[];
}

export async function fetchReportsList(): Promise<ReportInfo[]> {
  const res = await internalApi.get("/api/reports");
  return res.data as ReportInfo[];
}

export async function runReportById(
  reportId: number
): Promise<RunReportResponse> {
  const res = await internalApi.post(`/api/reports/${reportId}/run`);
  return res.data as RunReportResponse;
}

export async function sendDeliveryResult(params: {
  reportId: number;
  userId: number;
  scheduleId: number;
  status: "SUCCESS" | "ERROR";
  error?: string | null;
}) {
  await internalApi.post("/api/schedules/delivery-result", params);
}
