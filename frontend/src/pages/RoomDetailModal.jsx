import { useState, useMemo, useEffect } from "react";
import { CalendarIcon, Users, Check, AlertTriangle } from "lucide-react";
import { useApp } from "../context/AppContext";
import api, { fileUrl } from "../lib/api";
import { formatRupiah, daysBetween, computeAddonTotal, formatDate } from "../lib/format";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Calendar } from "../components/ui/calendar";

function toISO(d) {
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function RoomDetailModal({ room, open, onClose }) {
  const { settings, addToCart } = useApp();
  const addons = settings?.addons || [];

  const [checkin, setCheckin] = useState(null);
  const [checkout, setCheckout] = useState(null);
  const [selected, setSelected] = useState({}); // id -> qty
  const [notes, setNotes] = useState("");
  const [available, setAvailable] = useState(null); // null=unknown, true, false
  const [checkingAvail, setCheckingAvail] = useState(false);

  useEffect(() => {
    if (open) {
      setCheckin(null);
      setCheckout(null);
      setSelected({});
      setNotes("");
      setAvailable(null);
    }
  }, [open, room]);

  const days = useMemo(() => daysBetween(toISO(checkin), toISO(checkout)), [checkin, checkout]);

  useEffect(() => {
    if (!room || days <= 0) {
      setAvailable(null);
      return;
    }
    let cancelled = false;
    setCheckingAvail(true);
    api
      .get("/availability", { params: { room_id: room.id, checkin: toISO(checkin), checkout: toISO(checkout) } })
      .then(({ data }) => {
        if (!cancelled) setAvailable(data.available);
      })
      .catch(() => {
        if (!cancelled) setAvailable(null);
      })
      .finally(() => {
        if (!cancelled) setCheckingAvail(false);
      });
    return () => {
      cancelled = true;
    };
  }, [room, checkin, checkout, days]);
  const roomTotal = (room?.price || 0) * (days || 0);

  const addonLines = useMemo(() => {
    return addons
      .filter((a) => selected[a.id] !== undefined)
      .map((a) => {
        const qty = a.type === "flat" ? 1 : Math.max(1, Number(selected[a.id]) || 1);
        const total = computeAddonTotal({ ...a, qty }, days || 1);
        return { ...a, qty, total };
      });
  }, [addons, selected, days]);

  const addonsTotal = addonLines.reduce((s, a) => s + a.total, 0);
  const grandTotal = roomTotal + addonsTotal;

  const toggleAddon = (a, checked) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (checked) next[a.id] = a.type === "flat" ? 1 : 1;
      else delete next[a.id];
      return next;
    });
  };

  const handleAdd = () => {
    const item = {
      room_id: room.id,
      room_name: room.name,
      photo: room.photo,
      base_price: room.price,
      checkin: toISO(checkin),
      checkout: toISO(checkout),
      days,
      room_total: roomTotal,
      addons: addonLines.map((a) => ({
        name: a.name,
        qty: a.qty,
        unit_price: a.price,
        total: a.total,
        unit: a.unit,
      })),
      addons_total: addonsTotal,
      notes,
      total: grandTotal,
    };
    addToCart(item);
    onClose();
  };

  if (!room) return null;
  const canAdd = days > 0 && available !== false;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto bg-slate-800 border-slate-700 text-slate-100 p-0">
        <div className="relative h-56 overflow-hidden rounded-t-lg">
          <img src={fileUrl(room.photo)} alt={room.name} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-800 to-transparent" />
          <div className="absolute bottom-4 left-6 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/70 backdrop-blur text-xs text-slate-200">
            <Users className="h-3.5 w-3.5 text-amber-400" /> Kapasitas {room.capacity} orang
          </div>
        </div>

        <div className="px-6 pb-6 pt-2">
          <DialogHeader>
            <DialogTitle data-testid="room-modal-title" className="font-serif text-3xl text-slate-50">
              {room.name}
            </DialogTitle>
          </DialogHeader>
          <p className="mt-2 text-slate-400 text-sm leading-relaxed">{room.description}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            {(room.features || []).map((f) => (
              <span key={f} className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-slate-700/60 text-slate-200">
                <Check className="h-3 w-3 text-amber-400" /> {f}
              </span>
            ))}
          </div>

          <div className="mt-4 text-amber-400 font-bold text-lg">
            {formatRupiah(room.price)} <span className="text-xs text-slate-500 font-normal">/ hari</span>
          </div>

          {/* Dates */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Check-in</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    data-testid="checkin-trigger"
                    variant="outline"
                    className="mt-2 w-full justify-start bg-slate-900 border-slate-700 text-slate-100 hover:bg-slate-900 hover:text-amber-400"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-amber-400" />
                    {checkin ? formatDate(checkin) : "Pilih tanggal"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-slate-800 border-slate-700" align="start">
                  <Calendar
                    mode="single"
                    selected={checkin}
                    onSelect={(d) => {
                      setCheckin(d);
                      if (checkout && d && checkout <= d) setCheckout(null);
                    }}
                    disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Check-out</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    data-testid="checkout-trigger"
                    variant="outline"
                    className="mt-2 w-full justify-start bg-slate-900 border-slate-700 text-slate-100 hover:bg-slate-900 hover:text-amber-400"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-amber-400" />
                    {checkout ? formatDate(checkout) : "Pilih tanggal"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-slate-800 border-slate-700" align="start">
                  <Calendar
                    mode="single"
                    selected={checkout}
                    onSelect={setCheckout}
                    defaultMonth={checkin || undefined}
                    disabled={(d) => !checkin || d <= checkin}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          {days > 0 && (
            <div className="mt-2 flex items-center gap-3 flex-wrap">
              <p className="text-sm text-slate-400">
                Durasi sewa: <span className="text-amber-400 font-medium">{days} hari</span>
              </p>
              {checkingAvail && <span className="text-xs text-slate-500">Memeriksa ketersediaan...</span>}
              {!checkingAvail && available === true && (
                <span data-testid="avail-ok" className="inline-flex items-center gap-1 text-xs text-emerald-400"><Check className="h-3 w-3" /> Tersedia</span>
              )}
              {!checkingAvail && available === false && (
                <span data-testid="avail-no" className="inline-flex items-center gap-1 text-xs text-red-400"><AlertTriangle className="h-3 w-3" /> Sudah dibooking pada tanggal ini</span>
              )}
            </div>
          )}

          {/* Add-ons */}
          <div className="mt-6">
            <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Layanan Tambahan</label>
            <div className="mt-3 space-y-3">
              {addons.map((a) => {
                const isSel = selected[a.id] !== undefined;
                return (
                  <div
                    key={a.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                      isSel ? "border-amber-500/50 bg-amber-500/5" : "border-slate-700 bg-slate-900/40"
                    }`}
                  >
                    <Checkbox
                      data-testid={`addon-${a.id}`}
                      checked={isSel}
                      onCheckedChange={(c) => toggleAddon(a, c)}
                      className="border-slate-600 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-100">{a.name}</div>
                      <div className="text-xs text-slate-500">
                        {formatRupiah(a.price)}
                        {a.unit ? ` / ${a.unit}` : ""}
                      </div>
                    </div>
                    {isSel && a.type !== "flat" && (
                      <Input
                        data-testid={`addon-qty-${a.id}`}
                        type="number"
                        min={1}
                        value={selected[a.id]}
                        onChange={(e) =>
                          setSelected((prev) => ({ ...prev, [a.id]: e.target.value }))
                        }
                        className="w-20 bg-slate-900 border-slate-700 text-slate-100 h-9"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div className="mt-6">
            <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Catatan Khusus</label>
            <Textarea
              data-testid="room-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: butuh dekorasi tema emas, akses lift untuk katering..."
              className="mt-2 bg-slate-900 border-slate-700 text-slate-100 min-h-[80px]"
            />
          </div>

          {/* Total + CTA */}
          <div className="mt-6 sticky bottom-0 -mx-6 px-6 py-4 bg-slate-800/95 backdrop-blur border-t border-slate-700 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500">Total Estimasi</div>
              <div data-testid="modal-total" className="text-2xl font-bold text-amber-400">
                {formatRupiah(grandTotal)}
              </div>
              {!canAdd && days <= 0 && (
                <p className="text-xs text-amber-400/80">Pilih tanggal dulu.</p>
              )}
              {!canAdd && days > 0 && available === false && (
                <p className="text-xs text-red-400/90">Ruangan sudah dibooking pada tanggal ini.</p>
              )}
            </div>
            <Button
              data-testid="add-to-cart-btn"
              disabled={!canAdd}
              onClick={handleAdd}
              className="rounded-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-8 h-12 disabled:opacity-40"
            >
              Tambah ke Keranjang
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
