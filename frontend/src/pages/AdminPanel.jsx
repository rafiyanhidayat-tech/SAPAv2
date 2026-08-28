import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { LayoutDashboard, Settings, Users, LogOut, ArrowLeft } from "lucide-react";
import { useApp } from "../context/AppContext";
import api, { apiErr } from "../lib/api";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import AdminDashboard from "./AdminDashboard";
import AdminSettings from "./AdminSettings";
import AdminAccounts from "./AdminAccounts";

export default function AdminPanel() {
  const { admin, authReady, logout, checkExpiry, settings } = useApp();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);

  const loadBookings = useCallback(async () => {
    try {
      const { data } = await api.get("/bookings");
      setBookings(data);
    } catch (e) {
      if (e?.response?.status === 401) {
        logout();
        navigate("/");
      } else {
        toast.error(apiErr(e));
      }
    }
  }, [logout, navigate]);

  useEffect(() => {
    if (!authReady) return;
    if (!admin || !checkExpiry()) {
      navigate("/");
      return;
    }
    loadBookings();
  }, [authReady, admin, checkExpiry, navigate, loadBookings]);

  if (!authReady || !admin || !settings) return null;

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button data-testid="back-to-site" onClick={() => navigate("/")} className="text-slate-400 hover:text-amber-400 transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="font-serif text-2xl text-amber-500">Admin Panel</div>
              <div className="text-xs text-slate-500">Masuk sebagai {admin.name}</div>
            </div>
          </div>
          <Button data-testid="admin-logout-btn" onClick={handleLogout} variant="outline" className="rounded-full border-slate-600 text-slate-200 hover:bg-slate-800">
            <LogOut className="h-4 w-4 mr-2" /> Logout
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-10">
        <Tabs defaultValue="dashboard">
          <TabsList className="bg-slate-800 border border-slate-700 p-1 rounded-full h-auto flex-wrap">
            <TabsTrigger data-testid="tab-dashboard" value="dashboard" className="rounded-full data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900 px-5 py-2 text-slate-300">
              <LayoutDashboard className="h-4 w-4 mr-2" /> Dashboard
            </TabsTrigger>
            <TabsTrigger data-testid="tab-settings" value="settings" className="rounded-full data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900 px-5 py-2 text-slate-300">
              <Settings className="h-4 w-4 mr-2" /> Pengaturan
            </TabsTrigger>
            <TabsTrigger data-testid="tab-accounts" value="accounts" className="rounded-full data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900 px-5 py-2 text-slate-300">
              <Users className="h-4 w-4 mr-2" /> Akun Admin
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-8">
            <AdminDashboard bookings={bookings} reload={loadBookings} />
          </TabsContent>
          <TabsContent value="settings" className="mt-8">
            <AdminSettings />
          </TabsContent>
          <TabsContent value="accounts" className="mt-8">
            <AdminAccounts />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
