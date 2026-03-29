import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import SchedulesPage from "./pages/SchedulesPage";
import LogsPage from "./pages/LogsPage";
import UsersPage from "./pages/UsersPage";
import IntegrationsPage from "./pages/IntegrationsPage";
import AdminShell from "./layouts/AdminShell";

type AuthUser = {
  id: number;
  username: string;
  role: "ADMIN" | "ANALYST" | "VIEWER";
};

// Берём токен из localStorage.
// Если токен есть — считаем, что пользователь авторизован.
const isAuthenticated = (): boolean => {
  const token = localStorage.getItem("authToken");
  return Boolean(token);
};

// Достаём текущего пользователя из localStorage.
// Если JSON повреждён или данных нет — возвращаем null.
const getAuthUser = (): AuthUser | null => {
  const raw = localStorage.getItem("authUser");

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
};

// Защита приватных маршрутов.
// Если токена нет — отправляем пользователя на страницу входа.
const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Отдельная защита только для ADMIN.
// ANALYST и VIEWER сюда не допускаются.
const RequireAdmin: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = getAuthUser();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== "ADMIN") {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />

        <Route
          path="/admin"
          element={
            <RequireAuth>
              <AdminShell />
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
          <Route
            path="users"
            element={
              <RequireAdmin>
                <UsersPage />
              </RequireAdmin>
            }
          />
          <Route path="integrations" element={<IntegrationsPage />} />
          <Route path="schedules" element={<SchedulesPage />} />
          <Route path="logs" element={<LogsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;