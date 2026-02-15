import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import SchedulesPage from "./pages/SchedulesPage";
import LogsPage from "./pages/LogsPage";
import AdminShell from "./layouts/AdminShell";

const isAuthenticated = (): boolean => {
  const t = localStorage.getItem("authToken");
  return Boolean(t);
};

const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />

        {/* Protected admin area */}
        <Route
          path="/admin"
          element={
            <RequireAuth>
              <AdminShell />
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="schedules" element={<SchedulesPage />} />
          <Route path="logs" element={<LogsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
