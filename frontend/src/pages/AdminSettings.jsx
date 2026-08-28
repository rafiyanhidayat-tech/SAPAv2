import { useState, useRef } from "react";
import { toast } from "sonner";
import { Upload, Save, RotateCcw, ImageIcon, Plus, Trash2, DoorOpen } from "lucide-react";
import api, { fileUrl, apiErr } from "../lib/api";
import { useApp } from "../context/AppContext";
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

function ImageField({ label, value, onChange, testid }) {
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
      <Label className="text-xs text-slate-400">{label}</Label>
      <div className="mt-2 flex gap-3 items-start">
        <div className="h-20 w-28 rounded-lg overflow-hidden bg-slate-900 border border-slate-700 shrink-0 grid place-items-center">
          {value ? <img src={fileUrl(value)} alt="preview" className="h-full w-full object-cover" /> : <ImageIcon className="h-6 w-6 text-slate-600" />}
        </div>
        <div className="flex-1 space-y-2">
          <Input data-testid={`${testid}-url`} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="URL gambar atau unggah" className="bg-slate-900 border-slate-700 text-slate-100 text-sm" />
          <input ref={inputRef} type="file" accept="image/*" hidden onChange={handleFile} />
          <Button data-testid={`${testid}-upload`} type="button" onClick={() => inputRef.current?.click()} disabled={uploading} variant="secondary" className="bg-slate-700 hover:bg-slate-600 text-slate-100 h-9">
            <Upload className="h-4 w-4 mr-2" /> {uploading ? "Mengunggah..." : "Unggah Foto"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, action, children }) {
  return (
    <div className="rounded-2xl bg-slate-800 p-6 border border-white/5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-xl text-slate-50">{title}</h3>
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

  const set = (key, val) => setDraft((d) => ({ ...d, [key]: val }));
  const setRoom = (idx, key, val) =>
    setDraft((d) => {
      const rooms = [...d.rooms];
      rooms[idx] = { ...rooms[idx], [key]: val };
      return { ...d, rooms };
    });
  const addRoom = () =>
    setDraft((d) => ({
      ...d,
      rooms: [
        ...d.rooms,
        { id: "room-" + Date.now(), name: "Ruangan Baru", capacity: 10, features: [], price: 0, description: "", photo: "" },
      ],
    }));
  const removeRoom = (idx) => {
    if (!window.confirm("Hapus ruangan ini?")) return;
    setDraft((d) => ({ ...d, rooms: d.rooms.filter((_, i) => i !== idx) }));
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
    setSaving(true);
    try {
      await api.put("/settings", { data: draft });
      await loadSettings();
      toast.success("Pengaturan Disimpan");
    } catch (e) {
      toast.error(apiErr(e));
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!window.confirm("Reset semua pengaturan ke default?")) return;
    try {
      const { data } = await api.post("/settings/reset");
      setDraft(JSON.parse(JSON.stringify(data)));
      await loadSettings();
      toast.success("Direset ke default");
    } catch (e) {
      toast.error(apiErr(e));
    }
  };

  if (!draft?.rooms) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 justify-end">
        <Button data-testid="settings-reset-btn" onClick={reset} variant="outline" className="rounded-full border-slate-600 text-slate-200 hover:bg-slate-800">
          <RotateCcw className="h-4 w-4 mr-2" /> Reset ke Default
        </Button>
        <Button data-testid="settings-save-btn" onClick={save} disabled={saving} className="rounded-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold">
          <Save className="h-4 w-4 mr-2" /> {saving ? "Menyimpan..." : "Simpan Pengaturan"}
        </Button>
      </div>

      <Section title="Konten Hero">
        <div>
          <Label className="text-xs text-slate-400">Hero Title</Label>
          <Input data-testid="settings-hero-title" value={draft.hero_title || ""} onChange={(e) => set("hero_title", e.target.value)} className="mt-1 bg-slate-900 border-slate-700 text-slate-100" />
        </div>
        <div>
          <Label className="text-xs text-slate-400">Hero Subtitle</Label>
          <Textarea data-testid="settings-hero-subtitle" value={draft.hero_subtitle || ""} onChange={(e) => set("hero_subtitle", e.target.value)} className="mt-1 bg-slate-900 border-slate-700 text-slate-100" />
        </div>
        <ImageField label="Gambar Hero" value={draft.hero_image} onChange={(v) => set("hero_image", v)} testid="settings-hero-image" />
      </Section>

      <Section
        title="Katalog Ruangan"
        action={
          <Button data-testid="add-room-btn" onClick={addRoom} className="rounded-full bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/30 h-9">
            <Plus className="h-4 w-4 mr-1" /> Tambah Ruangan
          </Button>
        }
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {draft.rooms.map((room, idx) => (
            <div key={room.id} data-testid={`settings-room-${room.id}`} className="rounded-xl bg-slate-900/50 p-4 border border-slate-700/60 space-y-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-xs text-slate-400"><DoorOpen className="h-4 w-4 text-amber-400" /> {room.name || "Ruangan"}</span>
                <button data-testid={`remove-room-${room.id}`} onClick={() => removeRoom(idx)} className="text-slate-500 hover:text-red-400 transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-slate-400">Nama</Label>
                  <Input data-testid={`settings-room-name-${room.id}`} value={room.name} onChange={(e) => setRoom(idx, "name", e.target.value)} className="mt-1 bg-slate-900 border-slate-700 text-slate-100" />
                </div>
                <div>
                  <Label className="text-xs text-slate-400">Kapasitas</Label>
                  <Input type="number" value={room.capacity} onChange={(e) => setRoom(idx, "capacity", Number(e.target.value) || 0)} className="mt-1 bg-slate-900 border-slate-700 text-slate-100" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-slate-400">Harga /hari</Label>
                <Input data-testid={`settings-room-price-${room.id}`} type="number" value={room.price} onChange={(e) => setRoom(idx, "price", Number(e.target.value) || 0)} className="mt-1 bg-slate-900 border-slate-700 text-slate-100" />
              </div>
              <div>
                <Label className="text-xs text-slate-400">Fasilitas (pisahkan dengan koma)</Label>
                <Input
                  value={(room.features || []).join(", ")}
                  onChange={(e) => setRoom(idx, "features", e.target.value.split(",").map((f) => f.trim()).filter(Boolean))}
                  className="mt-1 bg-slate-900 border-slate-700 text-slate-100"
                  placeholder="AC, Proyektor, Wi-Fi"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-400">Deskripsi</Label>
                <Textarea value={room.description || ""} onChange={(e) => setRoom(idx, "description", e.target.value)} className="mt-1 bg-slate-900 border-slate-700 text-slate-100 min-h-[60px]" />
              </div>
              <ImageField label="Foto Ruangan" value={room.photo} onChange={(v) => setRoom(idx, "photo", v)} testid={`settings-room-photo-${room.id}`} />
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Layanan Tambahan"
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

      <Section title="Pembayaran & Kontak">
        <ImageField label="Gambar QRIS" value={draft.qris_image} onChange={(v) => set("qris_image", v)} testid="settings-qris-image" />
        <div>
          <Label className="text-xs text-slate-400">No. WhatsApp Admin (untuk notifikasi booking)</Label>
          <Input data-testid="settings-whatsapp" value={draft.whatsapp_admin || ""} onChange={(e) => set("whatsapp_admin", e.target.value)} className="mt-1 bg-slate-900 border-slate-700 text-slate-100" placeholder="6281234567890 (kode negara tanpa +)" />
        </div>
        <div>
          <Label className="text-xs text-slate-400">Info Pembayaran</Label>
          <Textarea data-testid="settings-payment-info" value={draft.payment_info || ""} onChange={(e) => set("payment_info", e.target.value)} className="mt-1 bg-slate-900 border-slate-700 text-slate-100" />
        </div>
      </Section>
    </div>
  );
}
