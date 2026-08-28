import { useState, useRef, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { Upload, Save, RotateCcw, ImageIcon, Plus, Trash2, DoorOpen, X, Users, Info, Sparkles } from "lucide-react";
import api, { fileUrl, apiErr } from "../lib/api";
import { useApp } from "../context/AppContext";
import { formatRupiah } from "../lib/format";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";

function ImageField({ label, value, onChange, testid, hint }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      onChange(data.url);
      toast.success("Gambar diunggah");
    } catch (err) {
      toast.error(apiErr(err, "Upload gagal"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      {label && <Label className="text-xs text-slate-400">{label}</Label>}
      <div className="mt-2 flex gap-3 items-start">
        <div className="h-20 w-28 rounded-lg overflow-hidden bg-slate-900 border border-slate-700 shrink-0 grid place-items-center">
          {value ? <img src={fileUrl(value)} alt="preview" className="h-full w-full object-cover" /> : <ImageIcon className="h-6 w-6 text-slate-600" />}
        </div>
        <div className="flex-1 space-y-2">
          <input ref={inputRef} type="file" accept="image/*" hidden onChange={handleFile} />
          <Button data-testid={`${testid}-upload`} type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="w-full bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 h-10">
            <Upload className="h-4 w-4 mr-2" /> {uploading ? "Mengunggah..." : "Unggah Foto dari Perangkat"}
          </Button>
          <Input data-testid={`${testid}-url`} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="atau tempel URL gambar di sini" className="bg-slate-900 border-slate-700 text-slate-100 text-sm h-9" />
          {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
        </div>
      </div>
    </div>
  );
}

function FeatureTags({ value = [], onChange, testid }) {
  const [input, setInput] = useState("");
  const add = () => {
    const v = input.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setInput("");
  };
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2 min-h-[24px]">
        {value.length === 0 && <span className="text-xs text-slate-500">Belum ada fasilitas ditambahkan.</span>}
        {value.map((f) => (
          <span key={f} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
            {f}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== f))} className="hover:text-red-400">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          data-testid={testid}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="cth: AC — lalu tekan Enter"
          className="bg-slate-900 border-slate-700 text-slate-100 h-9"
        />
        <Button type="button" onClick={add} variant="secondary" className="bg-slate-700 hover:bg-slate-600 text-slate-100 h-9 shrink-0">
          <Plus className="h-4 w-4 mr-1" /> Tambah
        </Button>
      </div>
    </div>
  );
}

const emptyRoom = () => ({ name: "", capacity: 20, price: 0, description: "", features: [], photo: "" });

function RoomFormDialog({ open, onOpenChange, initial, onSubmit, saving }) {
  const [form, setForm] = useState(emptyRoom());
  useEffect(() => {
    if (open) setForm(initial ? { ...initial } : emptyRoom());
  }, [open, initial]);

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = () => {
    if (!form.name.trim()) return toast.error("Nama ruangan wajib diisi");
    if (!form.price || form.price <= 0) return toast.error("Harga per hari harus lebih dari 0");
    onSubmit(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-slate-800 border-slate-700 text-slate-100 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl flex items-center gap-2">
            <DoorOpen className="h-5 w-5 text-amber-400" /> {initial ? "Ubah Ruangan" : "Tambah Ruangan Baru"}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Isi detail ruangan di bawah ini. Perubahan langsung tersimpan setelah Anda menekan Simpan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-1">
          <div>
            <Label className="text-xs text-slate-400">Nama Ruangan *</Label>
            <Input data-testid="roomform-name" value={form.name} onChange={(e) => upd("name", e.target.value)} placeholder="cth: Ballroom Utama" className="mt-1 bg-slate-900 border-slate-700 text-slate-100" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-slate-400 flex items-center gap-1"><Users className="h-3 w-3" /> Kapasitas (orang)</Label>
              <Input data-testid="roomform-capacity" type="number" min={1} value={form.capacity} onChange={(e) => upd("capacity", Number(e.target.value) || 0)} className="mt-1 bg-slate-900 border-slate-700 text-slate-100" />
            </div>
            <div>
              <Label className="text-xs text-slate-400">Harga per Hari (Rp) *</Label>
              <Input data-testid="roomform-price" type="number" min={0} value={form.price} onChange={(e) => upd("price", Number(e.target.value) || 0)} className="mt-1 bg-slate-900 border-slate-700 text-slate-100" />
              {form.price > 0 && <p className="text-[11px] text-amber-400/80 mt-1">{formatRupiah(form.price)} / hari</p>}
            </div>
          </div>
          <div>
            <Label className="text-xs text-slate-400">Deskripsi Singkat</Label>
            <Textarea data-testid="roomform-desc" value={form.description} onChange={(e) => upd("description", e.target.value)} placeholder="Jelaskan keunggulan ruangan ini..." className="mt-1 bg-slate-900 border-slate-700 text-slate-100 min-h-[70px]" />
          </div>
          <div>
            <Label className="text-xs text-slate-400">Fasilitas</Label>
            <p className="text-[11px] text-slate-500 mb-2">Tambahkan satu per satu, tekan Enter atau tombol Tambah.</p>
            <FeatureTags testid="roomform-feature-input" value={form.features} onChange={(v) => upd("features", v)} />
          </div>
          <ImageField label="Foto Ruangan" value={form.photo} onChange={(v) => upd("photo", v)} testid="roomform-photo" hint="Ukuran ideal memanjang (landscape). Kosongkan jika belum ada." />
        </div>

        <DialogFooter className="mt-2 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full border-slate-600 text-slate-200 hover:bg-slate-700">Batal</Button>
          <Button data-testid="roomform-submit" onClick={submit} disabled={saving} className="rounded-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold">
            <Save className="h-4 w-4 mr-2" /> {saving ? "Menyimpan..." : "Simpan Ruangan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, subtitle, action, children }) {
  return (
    <div className="rounded-2xl bg-slate-800 p-6 border border-white/5 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-serif text-xl text-slate-50">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

const ADDON_TYPES = [
  { value: "flat", label: "Harga tetap" },
  { value: "per_pax", label: "Per pax" },
  { value: "per_qty_day", label: "Per orang / hari" },
];

export default function AdminSettings() {
  const { settings, loadSettings } = useApp();
  const [draft, setDraft] = useState(() => JSON.parse(JSON.stringify(settings || {})));
  const [saving, setSaving] = useState(false);
  const [roomDialog, setRoomDialog] = useState({ open: false, editId: null });
  const [deleteRoom, setDeleteRoom] = useState(null);
  const [resetOpen, setResetOpen] = useState(false);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(settings), [draft, settings]);

  const set = (key, val) => setDraft((d) => ({ ...d, [key]: val }));
  const setRoom = (idx, key, val) =>
    setDraft((d) => {
      const rooms = [...d.rooms];
      rooms[idx] = { ...rooms[idx], [key]: val };
      return { ...d, rooms };
    });

  // Persist a specific next-state immediately (used for add/delete room)
  const persist = async (next, msg) => {
    setSaving(true);
    try {
      await api.put("/settings", { data: next });
      await loadSettings();
      setDraft(JSON.parse(JSON.stringify(next)));
      toast.success(msg);
    } catch (e) {
      toast.error(apiErr(e));
    } finally {
      setSaving(false);
    }
  };

  const handleRoomSubmit = async (form) => {
    const rooms = [...draft.rooms];
    if (roomDialog.editId) {
      const idx = rooms.findIndex((r) => r.id === roomDialog.editId);
      rooms[idx] = { ...rooms[idx], ...form };
    } else {
      rooms.push({ id: "room-" + Date.now(), ...form });
    }
    await persist({ ...draft, rooms }, roomDialog.editId ? "Ruangan diperbarui" : "Ruangan ditambahkan");
    setRoomDialog({ open: false, editId: null });
  };

  const confirmDeleteRoom = async () => {
    const rooms = draft.rooms.filter((r) => r.id !== deleteRoom.id);
    await persist({ ...draft, rooms }, "Ruangan dihapus");
    setDeleteRoom(null);
  };

  const setAddon = (idx, key, val) =>
    setDraft((d) => {
      const addons = [...d.addons];
      addons[idx] = { ...addons[idx], [key]: key === "price" ? Number(val) || 0 : val };
      return { ...d, addons };
    });
  const addAddon = () =>
    setDraft((d) => ({
      ...d,
      addons: [...d.addons, { id: "addon-" + Date.now(), name: "Layanan Baru", price: 0, type: "flat", unit: "" }],
    }));
  const removeAddon = (idx) => setDraft((d) => ({ ...d, addons: d.addons.filter((_, i) => i !== idx) }));

  const save = async () => {
    await persist(draft, "Semua perubahan disimpan");
  };
  const revert = () => {
    setDraft(JSON.parse(JSON.stringify(settings)));
    toast.info("Perubahan dibatalkan");
  };
  const reset = async () => {
    try {
      const { data } = await api.post("/settings/reset");
      setDraft(JSON.parse(JSON.stringify(data)));
      await loadSettings();
      toast.success("Direset ke default");
    } catch (e) {
      toast.error(apiErr(e));
    } finally {
      setResetOpen(false);
    }
  };

  if (!draft?.rooms) return null;

  const editingRoom = roomDialog.editId ? draft.rooms.find((r) => r.id === roomDialog.editId) : null;

  return (
    <div className="space-y-6 pb-24">
      {/* Unsaved banner */}
      {dirty && (
        <div data-testid="unsaved-banner" className="sticky top-20 z-30 rounded-2xl bg-amber-500/10 border border-amber-500/40 backdrop-blur px-5 py-3 flex items-center justify-between gap-3">
          <span className="text-sm text-amber-200 flex items-center gap-2"><Info className="h-4 w-4" /> Ada perubahan yang belum disimpan.</span>
          <div className="flex gap-2">
            <Button onClick={revert} variant="outline" className="rounded-full border-slate-600 text-slate-200 hover:bg-slate-800 h-9">Batal</Button>
            <Button data-testid="settings-save-btn" onClick={save} disabled={saving} className="rounded-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold h-9">
              <Save className="h-4 w-4 mr-2" /> {saving ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </div>
        </div>
      )}

      <Section title="Konten Hero" subtitle="Teks besar & gambar utama di halaman depan.">
        <div>
          <Label className="text-xs text-slate-400">Judul Utama</Label>
          <Input data-testid="settings-hero-title" value={draft.hero_title || ""} onChange={(e) => set("hero_title", e.target.value)} className="mt-1 bg-slate-900 border-slate-700 text-slate-100" />
        </div>
        <div>
          <Label className="text-xs text-slate-400">Subjudul</Label>
          <Textarea data-testid="settings-hero-subtitle" value={draft.hero_subtitle || ""} onChange={(e) => set("hero_subtitle", e.target.value)} className="mt-1 bg-slate-900 border-slate-700 text-slate-100" />
        </div>
        <ImageField label="Gambar Hero" value={draft.hero_image} onChange={(v) => set("hero_image", v)} testid="settings-hero-image" />
      </Section>

      <Section
        title="Katalog Ruangan"
        subtitle={`${draft.rooms.length} ruangan aktif. Tambah, ubah, atau hapus dengan mudah.`}
        action={
          <Button data-testid="add-room-btn" onClick={() => setRoomDialog({ open: true, editId: null })} className="rounded-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold h-10">
            <Plus className="h-4 w-4 mr-1" /> Tambah Ruangan
          </Button>
        }
      >
        {draft.rooms.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-600 py-12 text-center">
            <DoorOpen className="h-10 w-10 mx-auto text-slate-600" />
            <p className="mt-3 text-slate-400">Belum ada ruangan. Ayo tambahkan ruangan pertama Anda.</p>
            <Button data-testid="add-first-room-btn" onClick={() => setRoomDialog({ open: true, editId: null })} className="mt-4 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold">
              <Plus className="h-4 w-4 mr-1" /> Tambah Ruangan Pertama
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {draft.rooms.map((room) => (
              <div key={room.id} data-testid={`settings-room-${room.id}`} className="rounded-xl bg-slate-900/50 border border-slate-700/60 overflow-hidden group">
                <div className="relative h-32 bg-slate-900">
                  {room.photo ? (
                    <img src={fileUrl(room.photo)} alt={room.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full grid place-items-center text-slate-600"><ImageIcon className="h-8 w-8" /></div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 to-transparent" />
                  <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between">
                    <div>
                      <div className="font-serif text-lg text-slate-50 leading-tight">{room.name || "Tanpa Nama"}</div>
                      <div className="text-[11px] text-slate-300 flex items-center gap-1"><Users className="h-3 w-3 text-amber-400" /> {room.capacity} orang</div>
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <div className="text-amber-400 font-semibold">{formatRupiah(room.price)}<span className="text-xs text-slate-500 font-normal">/hari</span></div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(room.features || []).slice(0, 4).map((f) => (
                      <span key={f} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-300">{f}</span>
                    ))}
                    {(room.features || []).length === 0 && <span className="text-[10px] text-slate-600">Tanpa fasilitas</span>}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button data-testid={`edit-room-${room.id}`} onClick={() => setRoomDialog({ open: true, editId: room.id })} variant="secondary" className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-100 h-9">
                      Ubah
                    </Button>
                    <Button data-testid={`remove-room-${room.id}`} onClick={() => setDeleteRoom(room)} variant="outline" className="border-red-500/40 text-red-300 hover:bg-red-500/10 h-9 px-3">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Layanan Tambahan"
        subtitle="Layanan opsional yang bisa dipilih tamu (MC, katering, dll)."
        action={
          <Button data-testid="add-addon-btn" onClick={addAddon} className="rounded-full bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/30 h-9">
            <Plus className="h-4 w-4 mr-1" /> Tambah Layanan
          </Button>
        }
      >
        <div className="space-y-3">
          {draft.addons.map((a, idx) => (
            <div key={a.id} data-testid={`settings-addon-${a.id}`} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end rounded-xl bg-slate-900/50 p-3 border border-slate-700/60">
              <div className="md:col-span-4">
                <Label className="text-xs text-slate-400">Nama</Label>
                <Input value={a.name} onChange={(e) => setAddon(idx, "name", e.target.value)} className="mt-1 bg-slate-900 border-slate-700 text-slate-100" />
              </div>
              <div className="md:col-span-3">
                <Label className="text-xs text-slate-400">Harga</Label>
                <Input data-testid={`settings-addon-price-${a.id}`} type="number" value={a.price} onChange={(e) => setAddon(idx, "price", e.target.value)} className="mt-1 bg-slate-900 border-slate-700 text-slate-100" />
              </div>
              <div className="md:col-span-3">
                <Label className="text-xs text-slate-400">Tipe</Label>
                <Select value={a.type} onValueChange={(v) => setAddon(idx, "type", v)}>
                  <SelectTrigger className="mt-1 bg-slate-900 border-slate-700 text-slate-100"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-slate-100">
                    {ADDON_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value} className="focus:bg-slate-700">{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2 flex items-end gap-2">
                <div className="flex-1">
                  <Label className="text-xs text-slate-400">Unit</Label>
                  <Input value={a.unit || ""} onChange={(e) => setAddon(idx, "unit", e.target.value)} className="mt-1 bg-slate-900 border-slate-700 text-slate-100" placeholder="pax" />
                </div>
                <button data-testid={`remove-addon-${a.id}`} onClick={() => removeAddon(idx)} className="text-slate-500 hover:text-red-400 mb-2.5">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Pembayaran & Kontak" subtitle="QRIS, nomor WhatsApp admin, dan info pembayaran.">
        <ImageField label="Gambar QRIS" value={draft.qris_image} onChange={(v) => set("qris_image", v)} testid="settings-qris-image" />
        <div>
          <Label className="text-xs text-slate-400">No. WhatsApp Admin</Label>
          <Input data-testid="settings-whatsapp" value={draft.whatsapp_admin || ""} onChange={(e) => set("whatsapp_admin", e.target.value)} className="mt-1 bg-slate-900 border-slate-700 text-slate-100" placeholder="6281234567890 (kode negara tanpa +)" />
          <p className="text-[11px] text-slate-500 mt-1">Dipakai untuk tombol notifikasi WhatsApp booking.</p>
        </div>
        <div>
          <Label className="text-xs text-slate-400">Info Pembayaran</Label>
          <Textarea data-testid="settings-payment-info" value={draft.payment_info || ""} onChange={(e) => set("payment_info", e.target.value)} className="mt-1 bg-slate-900 border-slate-700 text-slate-100" />
        </div>
        <div className="pt-2 border-t border-slate-700/60">
          <Button data-testid="settings-reset-btn" onClick={() => setResetOpen(true)} variant="ghost" className="text-slate-500 hover:text-red-400 hover:bg-transparent px-0">
            <RotateCcw className="h-4 w-4 mr-2" /> Kembalikan semua pengaturan ke bawaan
          </Button>
        </div>
      </Section>

      <RoomFormDialog
        open={roomDialog.open}
        onOpenChange={(o) => setRoomDialog((s) => ({ ...s, open: o }))}
        initial={editingRoom}
        onSubmit={handleRoomSubmit}
        saving={saving}
      />

      <AlertDialog open={!!deleteRoom} onOpenChange={(o) => !o && setDeleteRoom(null)}>
        <AlertDialogContent className="bg-slate-800 border-slate-700 text-slate-100">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-xl">Hapus ruangan ini?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Ruangan <span className="text-amber-400 font-medium">{deleteRoom?.name}</span> akan dihapus dari katalog dan tidak bisa dipesan lagi. Booking yang sudah ada tidak terpengaruh.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-700 border-slate-600 text-slate-100 hover:bg-slate-600">Batal</AlertDialogCancel>
            <AlertDialogAction data-testid="confirm-delete-room" onClick={confirmDeleteRoom} className="bg-red-500 hover:bg-red-400 text-white">
              Ya, Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent className="bg-slate-800 border-slate-700 text-slate-100">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-xl">Kembalikan ke pengaturan bawaan?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Semua ruangan, layanan, teks hero, QRIS, dan nomor WhatsApp akan dikembalikan ke setelan awal. Tindakan ini tidak bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-700 border-slate-600 text-slate-100 hover:bg-slate-600">Batal</AlertDialogCancel>
            <AlertDialogAction data-testid="confirm-reset" onClick={reset} className="bg-red-500 hover:bg-red-400 text-white">
              Ya, Kembalikan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
