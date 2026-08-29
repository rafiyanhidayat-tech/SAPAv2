import { useMemo } from "react";
import { toast } from "sonner";
import {
  Wallet,
  ListOrdered,
  CheckCircle2,
  Clock,
  Download,
  Trash2,
  BadgeCheck,
  Receipt,
  TrendingUp,
  FileText,
  MessageCircle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";
import api, { fileUrl, apiErr } from "../lib/api";
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
  pending: { label: "Pending", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30", color: "#f59e0b" },
  confirmed: { label: "Confirmed", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", color: "#10b981" },
  done: { label: "Done", cls: "bg-sky-500/15 text-sky-400 border-sky-500/30", color: "#38bdf8" },
  cancelled: { label: "Cancelled", cls: "bg-red-500/15 text-red-400 border-red-500/30", color: "#ef4444" },
};

function Metric({ icon: Icon, label, value, tint }) {
  return (
    <div className="rounded-2xl bg-slate-800 p-6 border border-white/5 hover:border-amber-500/30 transition-colors duration-300">
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
    const paidRevenue = bookings.filter((b) => b.payment_status === "paid").reduce((s, b) => s + (b.total || 0), 0);
    return {
      revenue,
      paidRevenue,
      total: bookings.length,
      confirmed: bookings.filter((b) => b.status === "confirmed").length,
      pending: bookings.filter((b) => b.status === "pending").length,
    };
  }, [bookings]);

  const revenuePerRoom = useMemo(() => {
    const map = {};
    bookings.filter((b) => b.status !== "cancelled").forEach((b) => {
      map[b.room_name] = (map[b.room_name] || 0) + (b.total || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [bookings]);

  const statusData = useMemo(
    () =>
      Object.keys(STATUS)
        .map((k) => ({ key: k, name: STATUS[k].label, value: bookings.filter((b) => b.status === k).length }))
        .filter((s) => s.value > 0),
    [bookings]
  );

  const changeStatus = async (id, status) => {
    try {
      await api.patch(`/bookings/${id}`, { status });
      toast.success("Status diperbarui");
      reload();
    } catch (e) {
      toast.error(apiErr(e));
    }
  };

  const togglePaid = async (b) => {
    const willBePaid = b.payment_status !== "paid";
    try {
      await api.patch(`/bookings/${b.id}/payment`, { payment_status: willBePaid ? "paid" : "unpaid" });
      toast.success(willBePaid ? "Ditandai Lunas" : "Ditandai Belum Lunas");
      reload();
      if (willBePaid) notifyGuestPaid(b);
    } catch (e) {
      toast.error(apiErr(e));
    }
  };

  const normalizePhone = (p) => {
    let d = (p || "").replace(/\D/g, "");
    if (d.startsWith("0")) d = "62" + d.slice(1);
    return d;
  };

  const notifyGuestPaid = (b) => {
    const ref = b.group_id.slice(0, 8).toUpperCase();
    const msg = `Halo ${b.guest_name}, pembayaran booking *${b.room_name}* (Ref ${ref}) telah kami terima. Status: *LUNAS*. Total ${formatRupiah(b.total)}. Terima kasih - Sapa-Panti Sosial.`;
    const num = normalizePhone(b.phone);
    const link = num
      ? `https://wa.me/${num}?text=${encodeURIComponent(msg)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    const w = window.open(link, "_blank");
    if (!w) toast.info("Popup diblokir. Klik tombol WhatsApp di baris untuk kirim konfirmasi.");
  };

  const downloadReceipt = async (b) => {
    try {
      const res = await api.get(`/bookings/${b.id}/receipt`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kwitansi-${b.group_id.slice(0, 8).toUpperCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast.success("Kwitansi diunduh");
    } catch (e) {
      let msg = "Gagal membuat kwitansi";
      try {
        if (e?.response?.data instanceof Blob) {
          const txt = await e.response.data.text();
          msg = JSON.parse(txt).detail || msg;
        }
      } catch (parseErr) {
        console.error("Gagal membaca pesan error kwitansi", parseErr);
      }
      toast.error(msg);
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
    const headers = ["Tamu", "Telepon", "Ruangan", "Check-in", "Check-out", "Hari", "Tambahan", "Total", "Metode Bayar", "Status Bayar", "Status", "Dibuat"];
    const rows = bookings.map((b) => [
      b.guest_name, b.phone, b.room_name, b.checkin, b.checkout, b.days,
      (b.addons || []).map((a) => `${a.name} x${a.qty}`).join("; "),
      b.total, b.payment_method, b.payment_status === "paid" ? "Lunas" : "Belum", b.status, b.created_at,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
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
        <Metric icon={Wallet} label="Pendapatan (Confirmed/Done)" value={formatRupiah(metrics.revenue)} tint="bg-amber-500/15 text-amber-400" />
        <Metric icon={BadgeCheck} label="Sudah Lunas" value={formatRupiah(metrics.paidRevenue)} tint="bg-emerald-500/15 text-emerald-400" />
        <Metric icon={ListOrdered} label="Total Pesanan" value={metrics.total} tint="bg-sky-500/15 text-sky-400" />
        <Metric icon={Clock} label="Menunggu" value={metrics.pending} tint="bg-orange-500/15 text-orange-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl bg-slate-800 p-6 border border-white/5">
          <h3 className="font-serif text-xl text-slate-50 flex items-center gap-2"><TrendingUp className="h-5 w-5 text-amber-400" /> Pendapatan per Ruangan</h3>
          <div className="mt-6 h-64">
            {revenuePerRoom.length === 0 ? (
              <p className="text-sm text-slate-500">Belum ada data.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenuePerRoom} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v / 1000000}jt`} />
                  <Tooltip
                    cursor={{ fill: "rgba(245,158,11,0.08)" }}
                    contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 12, color: "#f8fafc" }}
                    formatter={(v) => [formatRupiah(v), "Pendapatan"]}
                  />
                  <Bar dataKey="value" fill="#f59e0b" radius={[6, 6, 0, 0]} maxBarSize={64} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-slate-800 p-6 border border-white/5">
          <h3 className="font-serif text-xl text-slate-50">Status Pesanan</h3>
          <div className="mt-4 h-48">
            {statusData.length === 0 ? (
              <p className="text-sm text-slate-500">Belum ada data.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={72} paddingAngle={3} stroke="none">
                    {statusData.map((s) => (
                      <Cell key={s.key} fill={STATUS[s.key].color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 12, color: "#f8fafc" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {statusData.map((s) => (
              <div key={s.key} className="flex items-center gap-2 text-xs text-slate-300">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS[s.key].color }} />
                {s.name} ({s.value})
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-slate-800 border border-white/5 overflow-hidden">
        <div className="flex items-center justify-between p-6">
          <h3 className="font-serif text-xl text-slate-50">Data Booking</h3>
          <Button data-testid="export-csv-btn" onClick={exportCSV} className="rounded-full bg-slate-700 hover:bg-slate-600 text-slate-100">
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
                <TableHead className="text-slate-400">Total</TableHead>
                <TableHead className="text-slate-400">Bayar</TableHead>
                <TableHead className="text-slate-400">Bukti</TableHead>
                <TableHead className="text-slate-400">Status</TableHead>
                <TableHead className="text-slate-400 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.length === 0 && (
                <TableRow className="border-slate-700">
                  <TableCell colSpan={8} className="text-center text-slate-500 py-10">Belum ada booking.</TableCell>
                </TableRow>
              )}
              {bookings.map((b) => (
                <TableRow key={b.id} data-testid={`booking-row-${b.id}`} className="border-slate-700 hover:bg-slate-800/50">
                  <TableCell>
                    <div className="text-slate-100 font-medium">{b.guest_name}</div>
                    <div className="text-xs text-slate-500">{b.phone}</div>
                  </TableCell>
                  <TableCell className="text-slate-300">{b.room_name}</TableCell>
                  <TableCell className="text-slate-400 text-xs">{formatDate(b.checkin)}<br />→ {formatDate(b.checkout)}</TableCell>
                  <TableCell className="text-amber-400 font-medium whitespace-nowrap">{formatRupiah(b.total)}</TableCell>
                  <TableCell>
                    <button
                      data-testid={`payment-toggle-${b.id}`}
                      onClick={() => togglePaid(b)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-colors ${
                        b.payment_status === "paid"
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                          : "bg-slate-700/40 text-slate-400 border-slate-600 hover:text-amber-400"
                      }`}
                    >
                      <Receipt className="h-3 w-3" /> {b.payment_status === "paid" ? "Lunas" : "Belum"}
                    </button>
                  </TableCell>
                  <TableCell>
                    {b.payment_proof ? (
                      <a data-testid={`proof-link-${b.id}`} href={fileUrl(b.payment_proof)} target="_blank" rel="noopener noreferrer" className="block h-10 w-10 rounded-md overflow-hidden border border-slate-600">
                        <img src={fileUrl(b.payment_proof)} alt="bukti" className="h-full w-full object-cover" />
                      </a>
                    ) : (
                      <span className="text-xs text-slate-600">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs border ${STATUS[b.status]?.cls}`}>{STATUS[b.status]?.label || b.status}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      {b.payment_status === "paid" && (
                        <>
                          <button data-testid={`receipt-btn-${b.id}`} onClick={() => downloadReceipt(b)} title="Unduh Kwitansi PDF" className="text-slate-400 hover:text-amber-400 transition-colors">
                            <FileText className="h-4 w-4" />
                          </button>
                          <button data-testid={`wa-guest-${b.id}`} onClick={() => notifyGuestPaid(b)} title="Kirim konfirmasi WhatsApp ke tamu" className="text-slate-400 hover:text-emerald-400 transition-colors">
                            <MessageCircle className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      <Select value={b.status} onValueChange={(v) => changeStatus(b.id, v)}>
                        <SelectTrigger data-testid={`status-dropdown-${b.id}`} className="w-32 h-9 bg-slate-900 border-slate-700 text-slate-100 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700 text-slate-100">
                          {Object.keys(STATUS).map((k) => (
                            <SelectItem key={k} value={k} className="focus:bg-slate-700 text-xs">{STATUS[k].label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <button data-testid={`booking-delete-${b.id}`} onClick={() => remove(b.id)} className="text-slate-500 hover:text-red-400 transition-colors">
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
