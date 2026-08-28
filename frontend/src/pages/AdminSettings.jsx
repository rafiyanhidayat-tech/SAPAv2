import { useState, useRef } from "react";
import { toast } from "sonner";
import { Upload, Save, RotateCcw, ImageIcon } from "lucide-react";
import api, { fileUrl, apiErr } from "../lib/api";
import { useApp } from "../context/AppContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";

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
          {value ? (
            <img src={fileUrl(value)} alt="preview" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-6 w-6 text-slate-600" />
          )}
        </div>
        <div className="flex-1 space-y-2">
          <Input
            data-testid={`${testid}-url`}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="URL gambar atau unggah"
            className="bg-slate-900 border-slate-700 text-slate-100 text-sm"
          />
          <input ref={inputRef} type="file" accept="image/*" hidden onChange={handleFile} />
          <Button
            data-testid={`${testid}-upload`}
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            variant="secondary"
            className="bg-slate-700 hover:bg-slate-600 text-slate-100 h-9"
          >
            <Upload className="h-4 w-4 mr-2" /> {uploading ? "Mengunggah..." : "Unggah Foto"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-2xl bg-slate-800 p-6 border border-white/5 space-y-5">
      <h3 className="font-serif text-xl text-slate-50">{title}</h3>
      {children}
    </div>
  );
}

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
  const setAddon = (idx, val) =>
    setDraft((d) => {
      const addons = [...d.addons];
      addons[idx] = { ...addons[idx], price: Number(val) || 0 };
      return { ...d, addons };
    });

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

      <Section title="Ruangan (Harga & Foto)">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {draft.rooms.map((room, idx) => (
            <div key={room.id} className="rounded-xl bg-slate-900/50 p-4 border border-slate-700/60 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-slate-400">Nama</Label>
                  <Input data-testid={`settings-room-name-${room.id}`} value={room.name} onChange={(e) => setRoom(idx, "name", e.target.value)} className="mt-1 bg-slate-900 border-slate-700 text-slate-100" />
                </div>
                <div>
                  <Label className="text-xs text-slate-400">Harga /hari</Label>
                  <Input data-testid={`settings-room-price-${room.id}`} type="number" value={room.price} onChange={(e) => setRoom(idx, "price", Number(e.target.value) || 0)} className="mt-1 bg-slate-900 border-slate-700 text-slate-100" />
                </div>
              </div>
              <ImageField label="Foto Ruangan" value={room.photo} onChange={(v) => setRoom(idx, "photo", v)} testid={`settings-room-photo-${room.id}`} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Harga Layanan Tambahan">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {draft.addons.map((a, idx) => (
            <div key={a.id}>
              <Label className="text-xs text-slate-400">{a.name} {a.unit ? `(/${a.unit})` : ""}</Label>
              <Input data-testid={`settings-addon-${a.id}`} type="number" value={a.price} onChange={(e) => setAddon(idx, e.target.value)} className="mt-1 bg-slate-900 border-slate-700 text-slate-100" />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Pembayaran QRIS">
        <ImageField label="Gambar QRIS" value={draft.qris_image} onChange={(v) => set("qris_image", v)} testid="settings-qris-image" />
        <div>
          <Label className="text-xs text-slate-400">Info Pembayaran</Label>
          <Textarea data-testid="settings-payment-info" value={draft.payment_info || ""} onChange={(e) => set("payment_info", e.target.value)} className="mt-1 bg-slate-900 border-slate-700 text-slate-100" />
        </div>
      </Section>
    </div>
  );
}
