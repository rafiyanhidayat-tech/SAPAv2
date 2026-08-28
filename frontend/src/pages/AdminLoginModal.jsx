import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../context/AppContext";
import { apiErr } from "../lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

export default function AdminLoginModal({ open, onClose }) {
  const { login } = useApp();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(username, password);
      toast.success("Login berhasil");
      onClose();
      setUsername("");
      setPassword("");
      navigate("/admin");
    } catch (err) {
      toast.error(apiErr(err, "Login gagal"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm bg-slate-800 border-slate-700 text-slate-100">
        <DialogHeader>
          <div className="mx-auto grid place-items-center h-14 w-14 rounded-full bg-amber-500/15 border border-amber-500/30 mb-2">
            <ShieldCheck className="h-7 w-7 text-amber-400" />
          </div>
          <DialogTitle className="text-center font-serif text-2xl">Akses Admin</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 mt-2">
          <div>
            <Label className="text-xs text-slate-400">Username</Label>
            <Input
              data-testid="admin-login-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              className="mt-1 bg-slate-900 border-slate-700 text-slate-100"
              placeholder="admin"
            />
          </div>
          <div>
            <Label className="text-xs text-slate-400">Password</Label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                data-testid="admin-login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9 bg-slate-900 border-slate-700 text-slate-100"
                placeholder="••••••••"
              />
            </div>
          </div>
          <Button
            data-testid="admin-login-submit"
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold h-11"
          >
            {loading ? "Memproses..." : "Masuk"}
          </Button>
          <p className="text-center text-xs text-slate-500">Sesi otomatis berakhir setelah 15 menit.</p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
