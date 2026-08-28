import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import api, { apiErr } from "../lib/api";

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

const CART_KEY = "sapa_cart";
const SESSION_MS = 15 * 60 * 1000; // 15 minutes

export function AppProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [cart, setCart] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    } catch {
      return [];
    }
  });
  const [admin, setAdmin] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  // ---- Settings
  const loadSettings = useCallback(async () => {
    try {
      const { data } = await api.get("/settings");
      setSettings(data);
    } catch (e) {
      toast.error("Gagal memuat pengaturan");
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // ---- Cart persistence
  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart]);

  const addToCart = (item) => {
    setCart((prev) => [...prev, { ...item, cartId: Date.now() + "-" + Math.random().toString(36).slice(2, 7) }]);
    toast.success("Ditambahkan ke keranjang");
  };
  const removeFromCart = (cartId) => setCart((prev) => prev.filter((i) => i.cartId !== cartId));
  const clearCart = () => setCart([]);

  // ---- Auth (15 min session)
  const checkExpiry = useCallback(() => {
    const exp = Number(localStorage.getItem("sapa_expiry") || 0);
    if (exp && Date.now() > exp) {
      localStorage.removeItem("sapa_token");
      localStorage.removeItem("sapa_expiry");
      localStorage.removeItem("sapa_admin");
      setAdmin(null);
      return false;
    }
    return true;
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("sapa_token");
    const stored = localStorage.getItem("sapa_admin");
    if (token && checkExpiry() && stored) {
      setAdmin(JSON.parse(stored));
    }
    setAuthReady(true);
    const interval = setInterval(() => {
      if (localStorage.getItem("sapa_token") && !checkExpiry()) {
        toast.info("Sesi admin telah kadaluarsa");
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [checkExpiry]);

  const login = async (username, password) => {
    const { data } = await api.post("/auth/login", { username, password });
    localStorage.setItem("sapa_token", data.token);
    localStorage.setItem("sapa_expiry", String(Date.now() + SESSION_MS));
    localStorage.setItem("sapa_admin", JSON.stringify(data.admin));
    setAdmin(data.admin);
    return data.admin;
  };

  const logout = () => {
    localStorage.removeItem("sapa_token");
    localStorage.removeItem("sapa_expiry");
    localStorage.removeItem("sapa_admin");
    setAdmin(null);
    toast.success("Berhasil logout");
  };

  const value = {
    settings,
    setSettings,
    loadSettings,
    cart,
    addToCart,
    removeFromCart,
    clearCart,
    admin,
    authReady,
    login,
    logout,
    checkExpiry,
    apiErr,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
