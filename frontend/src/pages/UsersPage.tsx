import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import PageHeader from "../components/ui/PageHeader";
import Badge from "../components/ui/Badge";
import { api } from "../lib/api";

type UserRole = "ADMIN" | "ANALYST" | "VIEWER";

type UserItem = {
  id: number;
  username: string;
  role: UserRole;
  isActive: boolean;
  telegramId: string | null;
  bindCode: string | null;
  bindCodeExpiresAt: string | null;
  createdAt: string;
};

type ApiErrorResponse = {
  message?: string;
};

type CreateUserResponse = UserItem;

type BindCodeResponse = {
  message: string;
  data: {
    code: string;
    expiresAt: string;
  };
};

const roleLabel: Record<UserRole, string> = {
  ADMIN: "Администратор",
  ANALYST: "Аналитик",
  VIEWER: "Пользователь",
};

const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [bindLoadingId, setBindLoadingId] = useState<number | null>(null);
  const [statusLoadingId, setStatusLoadingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("VIEWER");
  const [isActive, setIsActive] = useState(true);

  const canCreate = useMemo(() => {
    return username.trim().length >= 3 && password.trim().length >= 4;
  }, [username, password]);

  function getErrorMessage(err: unknown, fallback: string): string {
    if (axios.isAxiosError<ApiErrorResponse>(err)) {
      return err.response?.data?.message ?? err.message ?? fallback;
    }

    if (err instanceof Error) {
      return err.message;
    }

    return fallback;
  }

  async function loadUsers(): Promise<void> {
    setLoading(true);
    setError(null);

    try {
      const res = await api.get<UserItem[]>("/api/users");
      setUsers(res.data);
    } catch (err: unknown) {
      console.error("load users error", err);
      setError(getErrorMessage(err, "Ошибка загрузки пользователей"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  async function handleCreateUser(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setFormLoading(true);
    setError(null);

    try {
      const res = await api.post<CreateUserResponse>("/api/users", {
        username: username.trim(),
        password: password.trim(),
        role,
        isActive,
      });

      setUsers((prev) => [...prev, res.data]);
      setUsername("");
      setPassword("");
      setRole("VIEWER");
      setIsActive(true);
    } catch (err: unknown) {
      console.error("create user error", err);
      setError(getErrorMessage(err, "Ошибка создания пользователя"));
    } finally {
      setFormLoading(false);
    }
  }

  async function handleToggleStatus(user: UserItem): Promise<void> {
    setStatusLoadingId(user.id);
    setError(null);

    try {
      const res = await api.patch<UserItem>(`/api/users/${user.id}/status`, {
        isActive: !user.isActive,
      });

      setUsers((prev) =>
        prev.map((item) => (item.id === user.id ? res.data : item))
      );
    } catch (err: unknown) {
      console.error("toggle user status error", err);
      setError(getErrorMessage(err, "Ошибка обновления статуса"));
    } finally {
      setStatusLoadingId(null);
    }
  }

  async function handleGenerateBindCode(userId: number): Promise<void> {
    setBindLoadingId(userId);
    setError(null);

    try {
      const res = await api.post<BindCodeResponse>(
        `/api/users/${userId}/telegram-bind-code`
      );

      setUsers((prev) =>
        prev.map((item) =>
          item.id === userId
            ? {
                ...item,
                bindCode: res.data.data.code,
                bindCodeExpiresAt: res.data.data.expiresAt,
              }
            : item
        )
      );
    } catch (err: unknown) {
      console.error("generate bind code error", err);
      setError(getErrorMessage(err, "Ошибка генерации bind code"));
    } finally {
      setBindLoadingId(null);
    }
  }

  function formatDate(value: string | null): string {
    if (!value) {
      return "—";
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return parsed.toLocaleString("ru-RU");
  }

  function renderRoleBadge(userRole: UserRole): React.ReactNode {
    if (userRole === "ADMIN") {
      return <Badge tone="warning">ADMIN</Badge>;
    }

    if (userRole === "ANALYST") {
      return <Badge tone="success">ANALYST</Badge>;
    }

    return <Badge tone="neutral">VIEWER</Badge>;
  }

  return (
    <div>
      <PageHeader
        title="Пользователи"
        description="Создание пользователей панели, управление ролями и генерация кода привязки Telegram."
      />

      {error ? (
        <div className="badge badge-danger" style={{ display: "inline-flex", marginBottom: 12 }}>
          {error}
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.15fr) minmax(0, 1fr)",
          gap: 16,
        }}
      >
        <Card>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 14 }}>Создать пользователя</div>
            <span className="muted" style={{ fontSize: 12 }}>
              ADMIN может создавать доступы в систему
            </span>
          </div>

          <form
            onSubmit={(e) => {
              void handleCreateUser(e);
            }}
            style={{ display: "grid", gap: 12, marginTop: 14 }}
          >
            <label className="label">
              Логин
              <input
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="например analyst_1"
              />
            </label>

            <label className="label">
              Пароль
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="минимум 4 символа"
              />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label className="label">
                Роль
                <select
                  className="select"
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                >
                  <option value="ADMIN">ADMIN</option>
                  <option value="ANALYST">ANALYST</option>
                  <option value="VIEWER">VIEWER</option>
                </select>
              </label>

              <label className="label">
                Статус
                <select
                  className="select"
                  value={isActive ? "active" : "inactive"}
                  onChange={(e) => setIsActive(e.target.value === "active")}
                >
                  <option value="active">Активен</option>
                  <option value="inactive">Неактивен</option>
                </select>
              </label>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Button type="submit" disabled={formLoading || !canCreate}>
                {formLoading ? "Создание…" : "Создать пользователя"}
              </Button>
            </div>
          </form>
        </Card>

        <Card>
          <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 8 }}>
            Описание функций
          </div>

          <div className="muted" style={{ fontSize: 13, lineHeight: 1.55 }}>
            Администратор создаёт пользователя, назначает ему роль и при необходимости
            генерирует одноразовый код привязки Telegram. После этого пользователь
            отправляет код боту и аккаунт связывается с записью в системе.
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            <div className="badge" style={{ justifyContent: "center" }}>
              ADMIN — полный доступ к панели
            </div>
            <div className="badge" style={{ justifyContent: "center" }}>
              ANALYST — отчёты, аналитика, логи, расписания
            </div>
            <div className="badge" style={{ justifyContent: "center" }}>
              VIEWER — работа через Telegram
            </div>
          </div>
        </Card>
      </div>

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
            <div style={{ fontWeight: 900, fontSize: 14 }}>Список пользователей</div>
            <span className="muted" style={{ fontSize: 12 }}>
              {loading ? "Загрузка…" : users.length ? `${users.length} шт.` : "—"}
            </span>
          </div>

          {loading ? (
            <div style={{ padding: 16 }} className="muted">
              Загрузка…
            </div>
          ) : users.length === 0 ? (
            <div style={{ padding: 16 }} className="muted">
              Пользователи пока отсутствуют.
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Логин</th>
                  <th>Роль</th>
                  <th>Статус</th>
                  <th>Telegram</th>
                  <th>Bind code</th>
                  <th>Истекает</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.id}</td>
                    <td>
                      <div style={{ display: "grid", gap: 4 }}>
                        <div style={{ fontWeight: 800 }}>{user.username}</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {roleLabel[user.role]}
                        </div>
                      </div>
                    </td>
                    <td>{renderRoleBadge(user.role)}</td>
                    <td>
                      {user.isActive ? (
                        <Badge tone="success">Активен</Badge>
                      ) : (
                        <Badge tone="neutral">Неактивен</Badge>
                      )}
                    </td>
                    <td style={{ maxWidth: 220 }}>
                      {user.telegramId ?? "—"}
                    </td>
                    <td style={{ fontWeight: 800, letterSpacing: "0.04em" }}>
                      {user.bindCode ?? "—"}
                    </td>
                    <td>{formatDate(user.bindCodeExpiresAt)}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            void handleGenerateBindCode(user.id);
                          }}
                          disabled={bindLoadingId === user.id || !user.isActive}
                        >
                          {bindLoadingId === user.id ? "Генерация…" : "Bind code"}
                        </Button>

                        <Button
                          variant={user.isActive ? "danger" : "secondary"}
                          onClick={() => {
                            void handleToggleStatus(user);
                          }}
                          disabled={statusLoadingId === user.id}
                        >
                          {statusLoadingId === user.id
                            ? "Сохранение…"
                            : user.isActive
                            ? "Отключить"
                            : "Включить"}
                        </Button>
                      </div>
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

export default UsersPage;