import React, { useMemo, useState } from "react";
import axios from "axios";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import PageHeader from "../components/ui/PageHeader";
import Badge from "../components/ui/Badge";
import { api } from "../lib/api";

type ImportResponse = {
  message: string;
  importedRows: number;
  totalRevenue: number;
  filename: string;
};

type TemplateResponse = {
  requiredColumns: string[];
  exampleRow: {
    sale_date: string;
    product_name: string;
    customer_name: string;
    quantity: number;
    price: number;
  };
  acceptedFormats: string[];
};

type ApiErrorResponse = {
  message?: string;
};

const formatMoney = (value: number): string =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);

const IntegrationsPage: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [template, setTemplate] = useState<TemplateResponse | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);
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

  const canUpload = useMemo(() => {
    return Boolean(selectedFile) && !uploading;
  }, [selectedFile, uploading]);

// Загружаем описание шаблона импорта.
// Показываем обязательные поля и пример строки для пользователя.
  async function loadTemplate(): Promise<void> {
    setLoadingTemplate(true);
    setError(null);

    try {
      const res = await api.get<TemplateResponse>("/api/integrations/template");
      setTemplate(res.data);
    } catch (err: unknown) {
      console.error("load template error", err);
      setError(getErrorMessage(err, "Ошибка загрузки шаблона"));
    } finally {
      setLoadingTemplate(false);
    }
  }

  async function handleUpload(): Promise<void> {
    if (!selectedFile) {
      return;
    }

    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await api.post<ImportResponse>("/api/integrations/import", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setResult(res.data);
      setSelectedFile(null);
    } catch (err: unknown) {
      console.error("upload integration file error", err);
      setError(getErrorMessage(err, "Ошибка импорта файла"));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Интеграции"
        description="Импорт выгрузок CSV/XLSX из внешних систем для демонстрации интеграции с CRM / 1С / Excel."
        right={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button variant="ghost" onClick={() => void loadTemplate()} disabled={loadingTemplate}>
              {loadingTemplate ? "Загрузка…" : "Показать шаблон"}
            </Button>
          </div>
        }
      />

      {error ? (
        <div className="badge badge-danger" style={{ display: "inline-flex", marginBottom: 12 }}>
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="badge badge-success" style={{ display: "inline-flex", marginBottom: 12 }}>
          {result.message}: {result.importedRows} строк, сумма {formatMoney(result.totalRevenue)}
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
          <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 12 }}>
            Импорт файла
          </div>

          <div className="muted" style={{ fontSize: 13, lineHeight: 1.55, marginBottom: 14 }}>
            Загрузите CSV или XLSX-файл с продажами. После импорта данные попадут в БД и будут
            использоваться в аналитике, графиках и отчётах.
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <label className="label">
              Файл выгрузки
              <input
                className="input"
                type="file"
                accept=".csv,.xlsx"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setSelectedFile(file);
                }}
              />
            </label>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Button onClick={() => void handleUpload()} disabled={!canUpload}>
                {uploading ? "Импорт…" : "Загрузить файл"}
              </Button>

              {selectedFile ? (
                <Badge tone="neutral">{selectedFile.name}</Badge>
              ) : (
                <Badge tone="neutral">Файл не выбран</Badge>
              )}
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 12 }}>
            Описание
          </div>

          <div className="muted" style={{ fontSize: 13, lineHeight: 1.55 }}>
            Сценарий: из внешней системы выгружается CSV/XLSX, затем файл
            загружается в приложение, проходит проверку и используется в отчётности. Это демонстрирует
            интеграцию с внешними источниками данных без необходимости подключать реальную 1С.
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            <div className="badge" style={{ justifyContent: "center" }}>
              Поддержка CSV
            </div>
            <div className="badge" style={{ justifyContent: "center" }}>
              Поддержка XLSX
            </div>
            <div className="badge" style={{ justifyContent: "center" }}>
              Проверка структуры файла
            </div>
          </div>
        </Card>
      </div>

      {template ? (
        <div style={{ marginTop: 16 }}>
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
              <div style={{ fontWeight: 900, fontSize: 14 }}>Шаблон файла</div>
              <span className="muted" style={{ fontSize: 12 }}>
                Форматы: {template.acceptedFormats.join(", ")}
              </span>
            </div>

            <div style={{ padding: 16, display: "grid", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Обязательные колонки</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {template.requiredColumns.map((column) => (
                    <Badge key={column} tone="neutral">
                      {column}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Пример строки</div>
                <pre
                  style={{
                    margin: 0,
                    padding: 12,
                    borderRadius: 12,
                    background: "rgba(15, 23, 42, 0.04)",
                    overflowX: "auto",
                    fontSize: 13,
                  }}
                >
{JSON.stringify(template.exampleRow, null, 2)}
                </pre>
              </div>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
};

export default IntegrationsPage;