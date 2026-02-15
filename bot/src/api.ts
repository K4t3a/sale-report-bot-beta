import axios from "axios";

const backendBaseUrl =
  process.env.BACKEND_BASE_URL ?? "http://localhost:4000";

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



export async function bindTelegramUserByCode(params: {
  code: string;
  telegramId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
}) {
  const url = `${backendBaseUrl}/api/users/telegram-bind`;
  const res = await axios.post(url, params);
  return res.data as { id: number; username: string; telegramId: string };
}

export async function fetchTodaySalesReport(): Promise<SalesReportResponse> {
  const url = `${backendBaseUrl}/api/reports/daily-sales`;
  const res = await axios.post(url, { period: "today" });
  return res.data as SalesReportResponse;
}


export interface DueRecipientDto {
  userId: number;
  telegramId: string;
}

export interface DueScheduleDto {
  scheduleId: number;
  reportName: string;
  summary: SalesReportSummary;
  csv: string;
  recipients: DueRecipientDto[];
}

export async function fetchDueSchedules(): Promise<DueScheduleDto[]> {
  const url = `${backendBaseUrl}/api/schedules/run-due`;
  const res = await axios.post(url);
  return res.data as DueScheduleDto[];
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

export async function fetchReportsList(): Promise<ReportInfo[]> {
  const url = `${backendBaseUrl}/api/reports`;
  const res = await axios.get(url);
  return res.data as ReportInfo[];
}

export async function runReportById(
  reportId: number
): Promise<RunReportResponse> {
  const url = `${backendBaseUrl}/api/reports/${reportId}/run`;
  const res = await axios.post(url);
  return res.data as RunReportResponse;
}
