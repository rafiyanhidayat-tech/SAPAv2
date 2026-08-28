import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("sapa_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function fileUrl(url) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  if (url.startsWith("/api/")) return `${BACKEND_URL}${url}`;
  return url;
}

export function apiErr(e, fallback = "Terjadi kesalahan") {
  const d = e?.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x?.msg || JSON.stringify(x)).join(" ");
  return e?.message || fallback;
}

export default api;
