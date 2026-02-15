import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";

const Icon = ({
  children,
}: {
  children: React.ReactNode;
}) => (
  <span
    style={{
      width: 18,
      height: 18,
      display: "inline-grid",
      placeItems: "center",
      color: "rgba(15, 23, 42, 0.70)",
    }}
  >
    {children}
  </span>
);

const IconChart = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M4 19V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M4 19H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M8 16V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M12 16V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M16 16V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const IconClock = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path
      d="M12 22a10 10 0 1 0-10-10 10 10 0 0 0 10 10Z"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const IconList = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M8 6h13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M8 12h13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M8 18h13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M3 6h.01" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    <path d="M3 12h.01" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    <path d="M3 18h.01" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
  </svg>
);

const IconBot = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path
      d="M7 11a5 5 0 0 1 10 0v6a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-6Z"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path d="M12 6V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M9 13h.01" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    <path d="M15 13h.01" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
  </svg>
);

const IconLogout = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M10 7V6a2 2 0 0 1 2-2h7v16h-7a2 2 0 0 1-2-2v-1" stroke="currentColor" strokeWidth="2" />
    <path d="M4 12h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M7 9l-3 3 3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const linkBase: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  borderRadius: 12,
  textDecoration: "none",
  color: "rgba(15, 23, 42, 0.85)",
  fontWeight: 600,
};

const AdminShell: React.FC = () => {
  const navigate = useNavigate();

  const username = localStorage.getItem("username") ?? "admin";
  const role = "ADMIN";

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    navigate("/login");
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "280px minmax(0, 1fr)",
        minHeight: "100vh",
      }}
    >
      {/* SIDEBAR */}
      <aside
        style={{
          padding: 18,
          borderRight: "1px solid rgba(15, 23, 42, 0.08)",
          background:
            "radial-gradient(900px 420px at 20% 0%, rgba(37, 99, 235, 0.10), transparent 60%), var(--bg)",
        }}
      >
        <div style={{ display: "grid", gap: 4, marginBottom: 14 }}>
          <div style={{ fontWeight: 900, fontSize: 16, letterSpacing: "-0.01em" }}>Sales Report</div>
          <div className="muted" style={{ fontSize: 12 }}>Админ-панель · beta</div>
        </div>

        <nav style={{ display: "grid", gap: 8, marginTop: 10 }}>
          <NavLink
            to="/admin"
            end
            style={({ isActive }) => ({
              ...linkBase,
              background: isActive ? "rgba(37, 99, 235, 0.10)" : "transparent",
              border: isActive ? "1px solid rgba(37, 99, 235, 0.16)" : "1px solid transparent",
            })}
          >
            <Icon><IconChart /></Icon>
            Отчёты
          </NavLink>

          <NavLink
            to="/admin/schedules"
            style={({ isActive }) => ({
              ...linkBase,
              background: isActive ? "rgba(37, 99, 235, 0.10)" : "transparent",
              border: isActive ? "1px solid rgba(37, 99, 235, 0.16)" : "1px solid transparent",
            })}
          >
            <Icon><IconClock /></Icon>
            Расписания
          </NavLink>

          <NavLink
            to="/admin/logs"
            style={({ isActive }) => ({
              ...linkBase,
              background: isActive ? "rgba(37, 99, 235, 0.10)" : "transparent",
              border: isActive ? "1px solid rgba(37, 99, 235, 0.16)" : "1px solid transparent",
            })}
          >
            <Icon><IconList /></Icon>
            Логи
          </NavLink>
        </nav>

        {/* SESSION */}
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid rgba(15, 23, 42, 0.08)" }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Сессия</div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ fontWeight: 800 }}>{username}</div>
            <Badge tone="neutral">{role}</Badge>
          </div>

          {/* BOT LINK moved here (минимализм) */}
          <a
            href="https://t.me/sales_r3port_bot"
            target="_blank"
            rel="noreferrer"
            style={{
              ...linkBase,
              fontWeight: 600,
              background: "rgba(15, 23, 42, 0.03)",
              border: "1px solid rgba(15, 23, 42, 0.08)",
              marginBottom: 10,
            }}
          >
            <Icon><IconBot /></Icon>
            Открыть бота
          </a>

          <Button
            variant="secondary"
            size="md"
            leftIcon={<IconLogout />}
            onClick={handleLogout}
            style={{ width: "100%", justifyContent: "center" }}
          >
            Выйти
          </Button>
        </div>
      </aside>

      {/* CONTENT */}
      <main style={{ padding: "22px 24px" }}>
        <Outlet />
      </main>
    </div>
  );
};

export default AdminShell;
