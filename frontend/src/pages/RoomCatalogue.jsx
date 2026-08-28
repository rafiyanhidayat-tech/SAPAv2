import { Users, ArrowUpRight } from "lucide-react";
import { useApp } from "../context/AppContext";
import { fileUrl } from "../lib/api";
import { formatRupiah } from "../lib/format";

export default function RoomCatalogue({ onSelectRoom }) {
  const { settings } = useApp();
  const rooms = settings?.rooms || [];

  return (
    <section id="katalog" className="relative py-24 max-w-7xl mx-auto px-5 sm:px-8">
      <div className="max-w-2xl">
        <span className="text-xs uppercase tracking-[0.3em] text-amber-500">Katalog Ruangan</span>
        <h2 className="mt-4 font-serif text-3xl sm:text-4xl font-bold tracking-tight text-slate-50">
          Pilih Venue Terbaik untuk Acara Anda
        </h2>
        <p className="mt-4 text-slate-400 leading-relaxed">
          Klik pada kartu ruangan untuk melihat detail fasilitas dan menambahkan layanan tambahan.
        </p>
      </div>

      <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {rooms.map((room, idx) => (
          <button
            key={room.id}
            data-testid={`room-card-${room.id}`}
            onClick={() => onSelectRoom(room)}
            style={{ animationDelay: `${idx * 90}ms` }}
            className="animate-fade-up group text-left bg-slate-800 rounded-2xl overflow-hidden border border-white/5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] hover:-translate-y-2 transition-transform duration-300"
          >
            <div className="relative aspect-[4/5] overflow-hidden">
              <img
                src={fileUrl(room.photo)}
                alt={room.name}
                className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/20 to-transparent" />
              <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/70 backdrop-blur text-xs text-slate-200 border border-white/10">
                <Users className="h-3.5 w-3.5 text-amber-400" />
                {room.capacity} orang
              </div>
              <div className="absolute top-4 right-4 grid place-items-center h-9 w-9 rounded-full bg-amber-500 text-slate-900 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <ArrowUpRight className="h-4 w-4" />
              </div>
            </div>
            <div className="p-6">
              <h3 className="font-serif text-2xl font-bold text-slate-50">{room.name}</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {(room.features || []).map((f) => (
                  <span key={f} className="text-[11px] px-2.5 py-1 rounded-full bg-slate-700/60 text-slate-300">
                    {f}
                  </span>
                ))}
              </div>
              <div className="mt-5 flex items-end justify-between">
                <div>
                  <div className="text-xs text-slate-500">Mulai dari</div>
                  <div data-testid={`room-price-${room.id}`} className="text-amber-400 font-bold text-lg">
                    {formatRupiah(room.price)}
                    <span className="text-xs text-slate-500 font-normal">/hari</span>
                  </div>
                </div>
                <span className="text-xs text-amber-500 group-hover:underline">Lihat Detail</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
