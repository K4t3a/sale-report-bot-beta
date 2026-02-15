import React from "react";
import { Link } from "react-router-dom";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";

const Container: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 22px" }}>{children}</div>
);

const Section: React.FC<{
  id?: string;
  kicker?: string;
  title: string;
  subtitle?: string;
  tone?: "none" | "soft"; // soft = локальный градиент
  children: React.ReactNode;
}> = ({ id, kicker, title, subtitle, tone = "none", children }) => {
  return (
    <section
      id={id}
      style={{
        position: "relative",
        padding: "58px 0",
        overflow: "hidden",
      }}
    >
      {tone === "soft" ? (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            // Локальный фон — всегда "прибит" к секции и не съезжает при скролле
            background:
              "radial-gradient(900px 420px at 25% 35%, rgba(37, 99, 235, 0.10), transparent 65%)," +
              "radial-gradient(820px 380px at 78% 45%, rgba(16, 185, 129, 0.10), transparent 62%)," +
              "linear-gradient(180deg, rgba(15, 23, 42, 0.02), rgba(15, 23, 42, 0))",
          }}
        />
      ) : null}

      <Container>
        <div style={{ position: "relative", marginBottom: 18 }}>
          {kicker ? (
            <div style={{ fontSize: 12, letterSpacing: "0.10em", fontWeight: 900, color: "var(--primary)" }}>
              {kicker}
            </div>
          ) : null}

          <h2 style={{ margin: "10px 0 0", fontSize: 26, fontWeight: 950, lineHeight: 1.15 }}>{title}</h2>

          {subtitle ? (
            <p className="muted" style={{ margin: "12px 0 0", maxWidth: 860, lineHeight: 1.75 }}>
              {subtitle}
            </p>
          ) : null}
        </div>

        <div style={{ position: "relative" }}>{children}</div>
      </Container>
    </section>
  );
};

const Nav: React.FC = () => {
  const links: Array<{ href: string; label: string }> = [
    { href: "#product", label: "Продукт" },
    { href: "#capabilities", label: "Функции" },
    { href: "#workflow", label: "Процесс" },
    { href: "#architecture", label: "Архитектура" },
  ];

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: "rgba(246, 248, 251, 0.9)",
        backdropFilter: "blur(10px)",
      }}
    >
      <Container>
        <div className="landing-nav">
          <div className="landing-nav-left">
            <div style={{ fontWeight: 700, letterSpacing: "0.01em", whiteSpace: "nowrap" }}>
              Sales Report Bot
            </div>
            <Badge tone="neutral">beta</Badge>
          </div>

          <nav className="landing-nav-center">
            {links.map((l) => (
              <a key={l.href} href={l.href} className="landing-nav-link">
                {l.label}
              </a>
            ))}
          </nav>

          <div className="landing-nav-right">
            <Link to="/login" className="landing-nav-login">
              Войти
            </Link>
          </div>
        </div>
      </Container>
    </div>
  );
};



const Feature: React.FC<{ title: string; desc: string }> = ({ title, desc }) => (
  <Card style={{ padding: 18 }}>
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ fontWeight: 950 }}>{title}</div>
      <div className="muted" style={{ fontSize: 13, lineHeight: 1.7 }}>
        {desc}
      </div>
    </div>
  </Card>
);

const MetricCard: React.FC<{ label: string; value: string; hint: string }> = ({ label, value, hint }) => (
  <Card style={{ padding: 18 }}>
    <div style={{ display: "grid", gap: 6 }}>
      <div
        className="muted"
        style={{ fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 900 }}
      >
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 1000, lineHeight: 1.1 }}>{value}</div>
      <div className="muted" style={{ fontSize: 13, lineHeight: 1.65 }}>
        {hint}
      </div>
    </div>
  </Card>
);

const Landing: React.FC = () => {
  return (
    <div style={{ minHeight: "100%" }}>
      <Nav />

      {/* HERO (локальный градиент) */}
      <section style={{ position: "relative", padding: "64px 0 38px", overflow: "hidden" }}>
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "radial-gradient(1000px 520px at 20% 25%, rgba(37, 99, 235, 0.12), transparent 62%)," +
              "radial-gradient(900px 480px at 80% 35%, rgba(16, 185, 129, 0.10), transparent 60%)," +
              "linear-gradient(180deg, rgba(15, 23, 42, 0.02), rgba(15, 23, 42, 0))",
          }}
        />
        <Container>
          <div style={{ position: "relative", display: "grid", gridTemplateColumns: "minmax(0, 1.25fr) minmax(0, 1fr)", gap: 16 }}>
            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Badge tone="neutral">Node.js</Badge>
                <Badge tone="neutral">PostgreSQL</Badge>
                <Badge tone="neutral">React</Badge>
              </div>

              <div>
                <div style={{ fontSize: 12, letterSpacing: "0.12em", fontWeight: 950, color: "var(--primary)" }}>
                  BETA VERSION
                </div>
                <h1
                  style={{
                    margin: "10px 0 0",
                    fontSize: 44,
                    fontWeight: 1000,
                    lineHeight: 1.05,
                    letterSpacing: "-0.02em",
                  }}
                >
                  Отчётность и рассылка
                  <br />
                  по расписанию
                </h1>
                <p className="muted" style={{ margin: "14px 0 0", maxWidth: 760, lineHeight: 1.75 }}>
                  Продукт формирует отчёты по продажам из PostgreSQL, показывает аналитику в админ-панели и отправляет
                  отчёты в Telegram по расписанию.
                </p>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link className="btn btn-primary" to="/login" style={{ borderRadius: 999 }}>
                  Открыть панель
                </Link>
                <a className="btn btn-ghost" href="#capabilities" style={{ borderRadius: 999 }}>
                  Смотреть функции
                </a>
              </div>

              <div className="muted" style={{ fontSize: 12 }}>
                Вход: <b>admin</b> / <b>admin</b>
              </div>
            </div>

            <Card style={{ padding: 18 }}>
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ fontWeight: 950 }}>Кратко</div>
                <div className="muted" style={{ fontSize: 13, lineHeight: 1.75 }}>
                  Backend с healthcheck и единым обработчиком ошибок. Админ-панель с графиком, отчётами, расписаниями и
                  логами доставки.
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Badge tone="neutral">health</Badge>
                  <Badge tone="neutral">reports</Badge>
                  <Badge tone="neutral">schedules</Badge>
                  <Badge tone="neutral">logs</Badge>
                </div>
              </div>
            </Card>
          </div>
        </Container>
      </section>

      <Section
        id="product"
        kicker="PRODUCT"
        title="Панель управления"
        subtitle="Единый интерфейс для отчётов, расписаний и контроля доставки."
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
          <MetricCard label="Отчёты" value="CSV + сводка" hint="Формирование отчёта за период и выгрузка в CSV." />
          <MetricCard label="Расписания" value="Daily / Weekly" hint="Запуск задач по времени и дню недели." />
          <MetricCard label="Логи" value="Статусы доставки" hint="История отправок с результатом и ошибками." />
        </div>
      </Section>

      {/* Здесь задаём soft-градиент локально (чтобы не “съезжал”) */}
      <Section
        id="capabilities"
        kicker="CAPABILITIES"
        title="Ключевые функции"
        subtitle="Функции, которые демонстрируют полноту решения и работу с данными."
        tone="soft"
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
          <Feature
            title="Генерация отчётов"
            desc="Формирование отчёта за период с метриками: выручка, количество заказов, количество единиц, средний чек."
          />
          <Feature
            title="График динамики"
            desc="Динамика выручки по дням для наглядной демонстрации аналитики."
          />
          <Feature
            title="Рассылки по расписанию"
            desc="Создание задач рассылки, выбор получателей, поддержка weekly-режима с указанием дня недели."
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14, marginTop: 14 }}>
          <Feature
            title="Контроль доставки"
            desc="Логи доставки с фиксацией статуса и контекста отправки (отчёт, пользователь, расписание, время)."
          />
          <Feature
            title="Надёжность API"
            desc="Единый обработчик ошибок, идентификатор запроса, healthcheck с проверкой подключения к базе."
          />
          <Feature
            title="Большие данные"
            desc="Демо-набор данных масштабируется параметрами генерации; отчёты строятся SQL-агрегациями."
          />
        </div>
      </Section>

      <Section
        id="workflow"
        kicker="WORKFLOW"
        title="Процесс"
        subtitle="Как данные проходят через систему: от базы до пользователя."
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
          <Feature title="PostgreSQL" desc="Данные продаж хранятся в таблице и используются для формирования отчётов." />
          <Feature title="Backend" desc="API формирует отчёт, метрики и CSV, а также отдаёт задачи рассылки по времени." />
          <Feature title="Telegram" desc="Бот получает задачи и отправляет отчёты пользователям, фиксируя результат." />
        </div>
      </Section>

      <Section
        id="architecture"
        kicker="ARCHITECTURE"
        title="Компоненты"
        subtitle="Структура проекта: backend, frontend и бот."
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
          <Card style={{ padding: 18 }}>
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ fontWeight: 950 }}>Backend</div>
              <div className="muted" style={{ fontSize: 13, lineHeight: 1.75 }}>
                Express API, PostgreSQL, отчёты, расписания, логи, аналитика.
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Badge tone="neutral">/api/health</Badge>
                <Badge tone="neutral">/api/reports</Badge>
                <Badge tone="neutral">/api/schedules</Badge>
              </div>
            </div>
          </Card>

          <Card style={{ padding: 18 }}>
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ fontWeight: 950 }}>Frontend</div>
              <div className="muted" style={{ fontSize: 13, lineHeight: 1.75 }}>
                Админ-панель: отчёты, расписания, логи. Единый UI стиль.
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Badge tone="neutral">dashboard</Badge>
                <Badge tone="neutral">schedules</Badge>
                <Badge tone="neutral">logs</Badge>
              </div>
            </div>
          </Card>

          <Card style={{ padding: 18 }}>
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ fontWeight: 950 }}>Bot</div>
              <div className="muted" style={{ fontSize: 13, lineHeight: 1.75 }}>
                Polling задач рассылки и отправка отчётов пользователям в Telegram.
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Badge tone="neutral">run-due</Badge>
                <Badge tone="neutral">delivery</Badge>
              </div>
            </div>
          </Card>
        </div>

        <div
        style={{
          marginTop: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
        }}
>     
        </div>
      </Section>

      <footer style={{ padding: "18px 0 40px" }}>
        <Container>
          <div className="muted" style={{ fontSize: 12 }}>
            © {new Date().getFullYear()} Sales Report Bot
          </div>
        </Container>
      </footer>
    </div>
  );
};

export default Landing;
