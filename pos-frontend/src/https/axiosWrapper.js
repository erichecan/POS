import axios from "axios";

const defaultHeader = {
  "Content-Type": "application/json",
  Accept: "application/json",
};

export const axiosWrapper = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL,
  withCredentials: true,
  headers: { ...defaultHeader },
});

const WRITABLE_METHODS = new Set(["post", "put", "patch", "delete"]);

const createIdempotencyKey = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

axiosWrapper.interceptors.request.use((config) => {
  const method = `${config.method || ""}`.toLowerCase();
  if (!WRITABLE_METHODS.has(method)) {
    return config;
  }

  const headers = config.headers || {};
  if (!headers["x-idempotency-key"]) {
    headers["x-idempotency-key"] = createIdempotencyKey();
  }

  config.headers = headers;
  return config;
});

// 2026-02-26: 401 时仅在非 /auth 页做整页跳转，避免在登录页 401 导致反复重定向闪屏
axiosWrapper.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      const pathname = window.location.pathname || "";
      if (pathname !== "/auth") {
        const origin = window.location.origin || "";
        if (origin) window.location.href = `${origin}/auth`;
      }
    }
    return Promise.reject(error);
  }
);
