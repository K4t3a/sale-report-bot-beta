# 📊 Sales Report Bot — конструктор Telegram-бота для автоматической отчётности

Полноценная система, состоящая из **Backend API + Admin Web + Telegram-бота**, предназначенная для автоматизации формирования и доставки отчётов по продажам.

Проект разработан в рамках дипломной работы.

---

# 🚀 Возможности

## 🔹 Backend (Node.js + Express + PostgreSQL)

* Генерация отчётов по периодам:

  * today
  * last7days
  * last30days
* Формирование CSV (с BOM + корректная кодировка)
* Планировщик отправки отчётов (schedules)
* Исключение дублей отправки
* Логирование доставок (`SUCCESS / ERROR`)
* REST API для фронтенда и бота

---

## 🔹 Telegram-бот (Telegraf)

* Привязка аккаунта через одноразовый код
* Команды:

  * `/today` — отчёт за сегодня
  * `/week` — отчёт за 7 дней
  * `/month` — отчёт за 30 дней
  * `/reports` — список отчётов
* Отправка:

  * текст + CSV.gz файл
* Автоматическая рассылка по расписанию
* Polling каждые 10 секунд
* Обработка ошибок доставки

---

## 🔹 Frontend (React)

* Авторизация администратора (JWT)
* Управление отчётами
* Настройка расписаний
* Просмотр логов отправок
* График аналитики продаж

---

# 🧱 Архитектура

```
Frontend (React)
        ↓
Backend API (Express)
        ↓
PostgreSQL
        ↓
Telegram Bot (Telegraf)
```

---

# 🛠️ Технологии

* **Backend:** Node.js, TypeScript, Express, pg
* **Frontend:** React, Vite, Recharts
* **Bot:** Telegraf, axios
* **Database:** PostgreSQL
* **Auth:** JWT
* **Testing:** Jest

---

# 📁 Структура проекта

```
sales-report-bot-beta/
  backend/
  frontend/
  bot/
  docker-compose.yml
```

---

# ⚙️ Установка и запуск

## 1. PostgreSQL (Docker)

```bash
docker compose up -d
```

---

## 2. Backend

```bash
cd backend
npm install
```

### .env

```env
PORT=4000
JWT_SECRET=dev-secret
DATABASE_URL=postgresql://sales_user:sales_pass@127.0.0.1:5432/sales
```

### Миграции и сид

```bash
npm run migrate
npm run seed
```

### Запуск

```bash
npm run dev
```

---

## 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## 4. Telegram Bot

```bash
cd bot
npm install
```

### .env

```env
BOT_TOKEN=your_token
BACKEND_BASE_URL=http://localhost:4000
```

### Запуск

```bash
npm run dev
```

---

# ⏱️ Как работает расписание

1. Админ создаёт расписание
2. Бот каждые 10 секунд вызывает:

   ```
   GET /api/schedules/due
   ```
3. Backend возвращает задачи
4. Бот отправляет отчёт
5. Backend фиксирует результат:

   * SUCCESS
   * ERROR

---

# 📡 Основные API

* `GET /api/health`
* `POST /api/auth/login`
* `GET /api/reports`
* `POST /api/reports/:id/run`
* `GET /api/schedules`
* `POST /api/schedules`
* `GET /api/schedules/due`
* `POST /api/schedules/delivery-result`
* `GET /api/logs`

---

# 🧪 Тестирование

```bash
cd backend
npm test
```

---

# 🔮 Roadmap

* Retry отправок
* Очереди сообщений
* PDF/XLSX экспорт
* Улучшенная безопасность
* Интеграции (CRM, 1С)

---

# 👨‍💻 Автор

Дипломный проект: автоматизация отчётности отдела продаж с интеграцией Telegram.
