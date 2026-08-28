import { useState } from "react";
import { Trash2, Calendar as CalIcon, ShoppingBag, QrCode } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../context/AppContext";
import api, { fileUrl, apiErr } from "../lib/api";
import { formatRupiah, formatDate } from "../lib/format";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "../components/ui/sheet";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

const PAYMENT_METHODS = ["QRIS", "Bank Transfer", "Debit Card", "E-Wallet", "Bayar di Tempat"];

export default function CartSheet({ open, onOpenChange }) {
  const { cart, removeFromCart, clearCart, settings } = useApp();
  const [guestName, setGuestName] = useState("");
  const [phone, setPhone] = useState("");
  const [payment, setPayment] = useState("QRIS");
  const [submitting, setSubmitting] = useState(false);

  const grandTotal = cart.reduce((s, i) => s + i.total, 0);

  const handleCheckout = async () => {
    if (!guestName.trim() || !phone.trim()) {
      toast.error("Nama Tamu dan No. Telepon wajib diisi");
      return;
    }
    if (cart.length === 0) return;
    setSubmitting(true);
    try {
      const items = cart.map((i) => ({
        room_id: i.room_id,
        room_name: i.room_name,
        checkin: i.checkin,
        checkout: i.checkout,
        days: i.days,
        base_price: i.base_price,
        room_total: i.room_total,
        addons: i.addons.map((a) => ({
          name: a.name,
          qty: a.qty,
          unit_price: a.unit_price,
          total: a.total,
        })),
        addons_total: i.addons_total,
        notes: i.notes,
        total: i.total,
      }));
      await api.post("/bookings", {
        guest_name: guestName,
        phone,
        payment_method: payment,
        items,
      });
      toast.success("Booking Berhasil! Status: Pending");
      clearCart();
      setGuestName("");
      setPhone("");
      onOpenChange(false);
    } catch (e) {
      toast.error(apiErr(e, "Gagal memproses booking"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        data-testid="cart-panel"
        className="w-full sm:max-w-md bg-slate-900 border-l border-slate-800 text-slate-100 overflow-y-auto p-0 flex flex-col"
      >
        <SheetHeader className="px-6 py-5 border-b border-slate-800">
          <SheetTitle className="font-serif text-2xl text-slate-50 flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-amber-400" /> Keranjang Sewa
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 px-6 py-4 space-y-4">
          {cart.length === 0 && (
            <div className="text-center py-16 text-slate-500">
              <ShoppingBag className="h-10 w-10 mx-auto mb-3 opacity-40" />
              Keranjang masih kosong.
            </div>
          )}

          {cart.map((item) => (
            <div
              key={item.cartId}
              data-testid="cart-item"
              className="rounded-xl bg-slate-800 border border-slate-700/60 p-4"
            >
              <div className="flex justify-between items-start gap-2">
                <div>
                  <h4 className="font-serif text-lg text-slate-50">{item.room_name}</h4>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                    <CalIcon className="h-3 w-3 text-amber-400" />
                    {formatDate(item.checkin)} → {formatDate(item.checkout)} ({item.days} hari)
                  </div>
                </div>
                <button
                  data-testid="cart-remove-btn"
                  onClick={() => removeFromCart(item.cartId)}
                  className="text-slate-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 text-sm space-y-1 text-slate-400">
                <div className="flex justify-between">
                  <span>Sewa ruangan</span>
                  <span>{formatRupiah(item.room_total)}</span>
                </div>
                {item.addons.map((a, idx) => (
                  <div key={idx} className="flex justify-between text-xs">
                    <span>+ {a.name} {a.qty > 1 ? `×${a.qty}` : ""}</span>
                    <span>{formatRupiah(a.total)}</span>
                  </div>
                ))}
                {item.notes && (
                  <div className="text-xs italic text-slate-500 pt-1">"{item.notes}"</div>
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-slate-700/60 flex justify-between font-medium">
                <span className="text-slate-300">Subtotal</span>
                <span className="text-amber-400">{formatRupiah(item.total)}</span>
              </div>
            </div>
          ))}
        </div>

        {cart.length > 0 && (
          <div className="px-6 py-5 border-t border-slate-800 space-y-4 bg-slate-900">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Grand Total</span>
              <span data-testid="cart-grand-total" className="text-2xl font-bold text-amber-400">
                {formatRupiah(grandTotal)}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-xs text-slate-400">Nama Tamu *</Label>
                <Input
                  data-testid="checkout-name"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="mt-1 bg-slate-800 border-slate-700 text-slate-100"
                  placeholder="Nama lengkap"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-400">No. Telepon *</Label>
                <Input
                  data-testid="checkout-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 bg-slate-800 border-slate-700 text-slate-100"
                  placeholder="08xxxxxxxxxx"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-400">Metode Pembayaran</Label>
                <Select value={payment} onValueChange={setPayment}>
                  <SelectTrigger
                    data-testid="checkout-payment"
                    className="mt-1 bg-slate-800 border-slate-700 text-slate-100"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-slate-100">
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m} className="focus:bg-slate-700">
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {payment === "QRIS" && (
                <div className="rounded-xl bg-slate-800 border border-slate-700 p-4 text-center">
                  {settings?.qris_image ? (
                    <img
                      data-testid="qris-image"
                      src={fileUrl(settings.qris_image)}
                      alt="QRIS"
                      className="mx-auto max-h-56 rounded-lg bg-white p-2"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-6 text-slate-500">
                      <QrCode className="h-10 w-10" />
                      <span className="text-xs">QRIS belum tersedia. Silakan pilih metode lain atau hubungi admin.</span>
                    </div>
                  )}
                  {settings?.payment_info && (
                    <p className="mt-3 text-xs text-slate-400 leading-relaxed">{settings.payment_info}</p>
                  )}
                </div>
              )}
            </div>

            <Button
              data-testid="checkout-submit-btn"
              onClick={handleCheckout}
              disabled={submitting}
              className="w-full rounded-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold h-12"
            >
              {submitting ? "Memproses..." : "Checkout Sekarang"}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
