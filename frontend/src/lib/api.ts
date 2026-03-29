import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

// Общий клиент для всех запросов панели.
// Перед каждым запросом автоматически подставляем JWT из localStorage.
export const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
});

// Перед каждым запросом подставляем JWT-токен.
// Так приватные маршруты панели не нужно настраивать вручную в каждом компоненте.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("authToken");

  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// Если backend вернул 401, очищаем локальную сессию.
// Это помогает не держать в браузере просроченный или недействительный токен.
api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      localStorage.removeItem("authToken");
      localStorage.removeItem("authUser");
    }

    return Promise.reject(error);
  }
);