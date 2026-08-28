import { useState, useEffect } from "react";
import { toast } from "sonner";
import { UserPlus, Trash2, Save, ShieldCheck } from "lucide-react";
import api, { apiErr } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";

export default function AdminAccounts() {
  const [admins, setAdmins] = useState([]);
  const [form, setForm] = useState({ name: "", username: "", password: "", active: true });
  const [creating, setCreating] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get("/admins");
      setAdmins(data);
    } catch (e) {
      toast.error(apiErr(e));
    }
  };
  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!form.name.trim() || !form.username.trim() || !form.password.trim()) {
      toast.error("Nama, username & password wajib diisi");
      return;
    }
    setCreating(true);
    try {
      await api.post("/admins", form);
      toast.success("Akun admin ditambahkan");
      setForm({ name: "", username: "", password: "", active: true });
      load();
    } catch (e) {
      toast.error(apiErr(e));
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (a, active) => {
    try {
      await api.put(`/admins/${a.id}`, { active });
      toast.success("Status akun diperbarui");
      load();
    } catch (e) {
      toast.error(apiErr(e));
    }
  };

  const remove = async (a) => {
    if (!window.confirm(`Hapus akun "${a.username}"?`)) return;
    try {
      await api.delete(`/admins/${a.id}`);
      toast.success("Akun dihapus");
      load();
    } catch (e) {
      toast.error(apiErr(e));
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="rounded-2xl bg-slate-800 p-6 border border-white/5 h-fit">
        <h3 className="font-serif text-xl text-slate-50 flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-amber-400" /> Tambah Akun
        </h3>
        <div className="mt-5 space-y-3">
          <div>
            <Label className="text-xs text-slate-400">Nama</Label>
            <Input data-testid="account-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 bg-slate-900 border-slate-700 text-slate-100" />
          </div>
          <div>
            <Label className="text-xs text-slate-400">Username</Label>
            <Input data-testid="account-username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="mt-1 bg-slate-900 border-slate-700 text-slate-100" />
          </div>
          <div>
            <Label className="text-xs text-slate-400">Password</Label>
            <Input data-testid="account-password" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="mt-1 bg-slate-900 border-slate-700 text-slate-100" />
          </div>
          <div className="flex items-center justify-between pt-1">
            <Label className="text-xs text-slate-400">Aktif</Label>
            <Switch data-testid="account-active" checked={form.active} onCheckedChange={(c) => setForm({ ...form, active: c })} />
          </div>
          <Button data-testid="account-create-btn" onClick={create} disabled={creating} className="w-full rounded-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold mt-2">
            <Save className="h-4 w-4 mr-2" /> {creating ? "Menyimpan..." : "Simpan Akun"}
          </Button>
        </div>
      </div>

      <div className="lg:col-span-2 space-y-3">
        {admins.map((a) => (
          <div key={a.id} data-testid={`admin-row-${a.id}`} className="rounded-xl bg-slate-800 border border-white/5 p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="grid place-items-center h-11 w-11 rounded-full bg-slate-700 text-amber-400 shrink-0">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-slate-100 font-medium flex items-center gap-2">
                  {a.name}
                  {a.is_owner && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">Owner</span>}
                </div>
                <div className="text-xs text-slate-500">@{a.username}</div>
              </div>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <div className="flex items-center gap-2">
                <span className={`text-xs ${a.active ? "text-emerald-400" : "text-slate-500"}`}>{a.active ? "Aktif" : "Nonaktif"}</span>
                <Switch data-testid={`admin-active-${a.id}`} checked={a.active} onCheckedChange={(c) => toggleActive(a, c)} disabled={a.is_owner} />
              </div>
              <button data-testid={`admin-delete-${a.id}`} onClick={() => remove(a)} disabled={a.is_owner} className="text-slate-500 hover:text-red-400 disabled:opacity-30 transition-colors">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
