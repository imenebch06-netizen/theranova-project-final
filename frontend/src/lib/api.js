import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "/api/v1";

export const TOKEN_KEY = "theranova.tokens";

export function getTokens() {
  try {
    return JSON.parse(localStorage.getItem(TOKEN_KEY) || "null");
  } catch {
    return null;
  }
}

export function setTokens(tokens) {
  if (tokens?.access) {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 25000,
});

api.interceptors.request.use((config) => {
  const tokens = getTokens();
  if (tokens?.access) {
    config.headers.Authorization = `Bearer ${tokens.access}`;
  }
  if (!config.headers["Content-Type"] && !(config.data instanceof FormData)) {
    config.headers["Content-Type"] = "application/json";
  }
  return config;
});

let refreshPromise = null;

async function refreshAccessToken() {
  const tokens = getTokens();
  if (!tokens?.refresh) throw new Error("No refresh token");
  const { data } = await axios.post(`${BASE_URL}/auth/refresh/`, {
    refresh: tokens.refresh,
  });
  const next = {
    access: data.access,
    refresh: data.refresh || tokens.refresh,
  };
  setTokens(next);
  return next.access;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config || {};
    const status = error.response?.status;
    const tokens = getTokens();

    if (
      status === 401 &&
      !original._retry &&
      tokens?.refresh &&
      !String(original.url || "").includes("/auth/login") &&
      !String(original.url || "").includes("/auth/refresh")
    ) {
      original._retry = true;
      try {
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null;
          });
        }
        const access = await refreshPromise;
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${access}`;
        return api(original);
      } catch {
        setTokens(null);
        window.dispatchEvent(new CustomEvent("theranova:logout"));
      }
    }

    return Promise.reject(error);
  },
);

export function extractError(error, fallback = "Une erreur est survenue.") {
  const data = error?.response?.data;
  if (!data) return error?.message || fallback;
  if (typeof data === "string") return data;
  if (data.detail) return data.detail;
  if (Array.isArray(data)) return data.join(" ");
  if (typeof data === "object") {
    const messages = [];
    Object.entries(data).forEach(([field, value]) => {
      const text = Array.isArray(value) ? value.join(" ") : String(value);
      messages.push(field === "non_field_errors" ? text : `${field} : ${text}`);
    });
    if (messages.length) return messages.join(" · ");
  }
  return fallback;
}

/** Follows DRF pagination and returns every result (max 10 pages). */
export async function getAll(url, params = {}, maxPages = 10) {
  const results = [];
  let page = 1;
  let next = true;
  while (next && page <= maxPages) {
    const { data } = await api.get(url, {
      params: { ...params, page, page_size: 100 },
    });
    if (Array.isArray(data)) {
      return data;
    }
    results.push(...(data.results || []));
    next = Boolean(data.next);
    page += 1;
  }
  return results;
}

export function unwrap(data) {
  if (Array.isArray(data)) return data;
  return data?.results ?? data;
}

export default api;
