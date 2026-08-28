import { useMemo } from "react";
import { toast } from "sonner";
import {
  Wallet,
  ListOrdered,
  CheckCircle2,
  Clock,
  Download,
  Trash2,
} from "lucide-react";
import api, { apiErr } from "../lib/api";
import { formatRupiah, formatDate } from "../lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Button } from "../components/ui/button";

const STATUS = {
  pending: { label: "Pending", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  confirmed: { label: "Confirmed", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  done: { label: "Done", cls: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
  cancelled: { label: "Cancelled", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
};

function Metric({ icon: Icon, label, value, tint }) {
  return (
    <div className="rounded-2xl bg-slate-800 p-6 border border-white/5">
      <div className={`grid place-items-center h-11 w-11 rounded-xl ${tint}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-4 text-2xl font-bold text-slate-50">{value}</div>
      <div className="text-xs text-slate-400 uppercase tracking-wider mt-1">{label}</div>
    </div>
  );
}

export default function AdminDashboard({ bookings, reload }) {
  const metrics = useMemo(() => {
    const revenue = bookings
      .filter((b) => b.status === "confirmed" || b.status === "done")
      .reduce((s, b) => s + (b.total || 0), 0);
    return {
      revenue,
      total: bookings.length,
      confirmed: bookings.filter((b) => b.status === "confirmed").length,
      pending: bookings.filter((b) => b.status === "pending").length,
    };
  }, [bookings]);

  const roomPopularity = useMemo(() => {
    const counts = {};
    bookings.forEach((b) => {
      counts[b.room_name] = (counts[b.room_name] || 0) + 1;
    });
    const max = Math.max(1, ...Object.values(counts));
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count, pct: Math.round((count / max) * 100) }))
      .sort((a, b) => b.count - a.count);
  }, [bookings]);

  const statusBreakdown = useMemo(() => {
    return Object.keys(STATUS).map((k) => ({
      key: k,
      label: STATUS[k].label,
      count: bookings.filter((b) => b.status === k).length,
    }));
  }, [bookings]);

  const changeStatus = async (id, status) => {
    try {
      await api.patch(`/bookings/${id}`, { status });
      toast.success("Status diperbarui");
      reload();
    } catch (e) {
      toast.error(apiErr(e));
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Hapus booking ini?")) return;
    try {
      await api.delete(`/bookings/${id}`);
      toast.success("Booking dihapus");
      reload();
    } catch (e) {
      toast.error(apiErr(e));
    }
  };

  const exportCSV = () => {
    const headers = ["Tamu", "Telepon", "Ruangan", "Check-in", "Check-out", "Hari", "Tambahan", "Total", "Metode Bayar", "Status", "Dibuat"];
    const rows = bookings.map((b) => [
      b.guest_name,
      b.phone,
      b.room_name,
      b.checkin,
      b.checkout,
      b.days,
      (b.addons || []).map((a) => `${a.name} x${a.qty}`).join("; "),
      b.total,
      b.payment_method,
      b.status,
      b.created_at,
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bookings-sapa-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV diunduh");
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Metric icon={Wallet} label="Total Pendapatan" value={formatRupiah(metrics.revenue)} tint="bg-amber-500/15 text-amber-400" />
        <Metric icon={ListOrdered} label="Total Pesanan" value={metrics.total} tint="bg-sky-500/15 text-sky-400" />
        <Metric icon={CheckCircle2} label="Terkonfirmasi" value={metrics.confirmed} tint="bg-emerald-500/15 text-emerald-400" />
        <Metric icon={Clock} label="Menunggu" value={metrics.pending} tint="bg-orange-500/15 text-orange-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl bg-slate-800 p-6 border border-white/5">
          <h3 className="font-serif text-xl text-slate-50">Ruangan Populer</h3>
          <div className="mt-5 space-y-4">
            {roomPopularity.length === 0 && <p className="text-sm text-slate-500">Belum ada data.</p>}
            {roomPopularity.map((r) => (
              <div key={r.name}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-slate-300">{r.name}</span>
                  <span className="text-slate-400">{r.count} pesanan</span>
                </div>
                <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${r.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-slate-800 p-6 border border-white/5">
          <h3 className="font-serif text-xl text-slate-50">Breakdown Status</h3>
          <div className="mt-5 grid grid-cols-2 gap-4">
            {statusBreakdown.map((s) => (
              <div key={s.key} className={`rounded-xl border p-4 ${STATUS[s.key].cls}`}>
                <div className="text-2xl font-bold">{s.count}</div>
                <div className="text-xs uppercase tracking-wider mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-slate-800 border border-white/5 overflow-hidden">
        <div className="flex items-center justify-between p-6">
          <h3 className="font-serif text-xl text-slate-50">Data Booking</h3>
          <Button
            data-testid="export-csv-btn"
            onClick={exportCSV}
            className="rounded-full bg-slate-700 hover:bg-slate-600 text-slate-100"
          >
            <Download className="h-4 w-4 mr-2" /> Download CSV
          </Button>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-700 hover:bg-transparent">
                <TableHead className="text-slate-400">Tamu</TableHead>
                <TableHead className="text-slate-400">Ruangan</TableHead>
                <TableHead className="text-slate-400">Check-in / out</TableHead>
                <TableHead className="text-slate-400">Tambahan</TableHead>
                <TableHead className="text-slate-400">Total</TableHead>
                <TableHead className="text-slate-400">Bayar</TableHead>
                <TableHead className="text-slate-400">Status</TableHead>
                <TableHead className="text-slate-400 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.length === 0 && (
                <TableRow className="border-slate-700">
                  <TableCell colSpan={8} className="text-center text-slate-500 py-10">
                    Belum ada booking.
                  </TableCell>
                </TableRow>
              )}
              {bookings.map((b) => (
                <TableRow key={b.id} data-testid={`booking-row-${b.id}`} className="border-slate-700 hover:bg-slate-800/50">
                  <TableCell>
                    <div className="text-slate-100 font-medium">{b.guest_name}</div>
                    <div className="text-xs text-slate-500">{b.phone}</div>
                  </TableCell>
                  <TableCell className="text-slate-300">{b.room_name}</TableCell>
                  <TableCell className="text-slate-400 text-xs">
                    {formatDate(b.checkin)}<br />→ {formatDate(b.checkout)}
                  </TableCell>
                  <TableCell className="text-slate-400 text-xs max-w-[160px]">
                    {(b.addons || []).length === 0 ? "-" : (b.addons || []).map((a) => `${a.name}${a.qty > 1 ? ` ×${a.qty}` : ""}`).join(", ")}
                  </TableCell>
                  <TableCell className="text-amber-400 font-medium whitespace-nowrap">{formatRupiah(b.total)}</TableCell>
                  <TableCell className="text-slate-400 text-xs">{b.payment_method}</TableCell>
                  <TableCell>
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs border ${STATUS[b.status]?.cls}`}>
                      {STATUS[b.status]?.label || b.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Select value={b.status} onValueChange={(v) => changeStatus(b.id, v)}>
                        <SelectTrigger data-testid={`status-dropdown-${b.id}`} className="w-32 h-9 bg-slate-900 border-slate-700 text-slate-100 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700 text-slate-100">
                          {Object.keys(STATUS).map((k) => (
                            <SelectItem key={k} value={k} className="focus:bg-slate-700 text-xs">
                              {STATUS[k].label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <button
                        data-testid={`booking-delete-${b.id}`}
                        onClick={() => remove(b.id)}
                        className="text-slate-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
