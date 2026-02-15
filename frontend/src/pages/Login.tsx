import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

const Login: React.FC = () => {
  const navigate = useNavigate();

  const [username, setUsername] = useState("admin");
  // По умолчанию: admin/admin (в .env seed)
  const [password, setPassword] = useState("admin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hint = useMemo(() => {
    return `API: ${API_BASE}`;
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const resp = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await resp.json().catch(() => null);
      if (!resp.ok) {
        throw new Error(data?.message ?? "Ошибка авторизации");
      }

      localStorage.setItem("authToken", data.token);
      localStorage.setItem("authUser", JSON.stringify(data.user));
      navigate("/admin", { replace: true });
    } catch (e) {
      console.error("login error", e);
      setError(e instanceof Error ? e.message : "Неизвестная ошибка");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100%",
        display: "grid",
        placeItems: "center",
        padding: 18,
      }}
    >
      <div
        style={{
          width: "min(980px, 100%)",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)",
          gap: 18,
          alignItems: "stretch",
        }}
      >
        <Card style={{ padding: 22 }}>
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ fontSize: 12, letterSpacing: "0.08em", fontWeight: 800, color: "var(--primary)" }}>
              SALES REPORT BOT
            </div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>
              Вход в админ-панель
            </h1>
            <p className="muted" style={{ margin: 0 }}>
              Для демонстрации используем локального администратора.
              После входа доступны отчёты, расписания и логи доставки.
            </p>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
              <Link className="btn btn-ghost" to="/">
                На лендинг
              </Link>
              <a
                className="btn btn-ghost"
                href="https://t.me/sales_r3port_bot"
                target="_blank"
                rel="noreferrer"
              >
                Открыть бота
              </a>
            </div>

            <div style={{ marginTop: 10, fontSize: 12 }} className="muted">
              {hint}
            </div>
          </div>
        </Card>

        <Card style={{ padding: 22 }}>
          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
            {error ? (
              <div className="badge badge-danger" style={{ justifyContent: "center" }}>
                {error}
              </div>
            ) : null}

            <label className="label">
              Логин
              <input
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </label>

            <label className="label">
              Пароль
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>

            <Button type="submit" disabled={loading}>
              {loading ? "Входим…" : "Войти"}
            </Button>

            <div style={{ fontSize: 12 }} className="muted">
              Дефолтные данные: <b>admin / admin</b>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default Login;
