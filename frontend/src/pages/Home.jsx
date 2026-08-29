import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { useApp } from "../context/AppContext";
import Header from "./Header";
import Hero from "./Hero";
import RoomCatalogue from "./RoomCatalogue";
import RoomDetailModal from "./RoomDetailModal";
import CartSheet from "./CartSheet";
import AdminLoginModal from "./AdminLoginModal";

export default function Home() {
  const { settings, admin } = useApp();
  const navigate = useNavigate();
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [roomOpen, setRoomOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  const openRoom = (room) => {
    setSelectedRoom(room);
    setRoomOpen(true);
  };

  const openAdmin = () => {
    if (admin) navigate("/admin");
    else setLoginOpen(true);
  };

  if (!settings) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-900 text-amber-500 font-serif text-2xl">
        Memuat...
      </div>
    );
  }

  return (
    <div className="App bg-slate-900">
      <Header onOpenCart={() => setCartOpen(true)} onOpenAdmin={openAdmin} />
      <Hero />
      <RoomCatalogue onSelectRoom={openRoom} />

      <footer className="border-t border-slate-800 py-10 text-center text-sm text-slate-500">
        <span className="font-serif text-amber-500 text-lg">Sapa-Panti Sosial</span>
        <p className="mt-2">Pemerintah Provinsi Kalimantan Utara · Panti Sosial</p>
        <a
          data-testid="guide-download-public"
          href={`${process.env.REACT_APP_BACKEND_URL}/api/guide`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-700 text-slate-300 hover:text-amber-400 hover:border-amber-500/40 transition-colors"
        >
          <BookOpen className="h-4 w-4" /> Unduh Buku Panduan (PDF)
        </a>
      </footer>

      <RoomDetailModal room={selectedRoom} open={roomOpen} onClose={() => setRoomOpen(false)} />
      <CartSheet open={cartOpen} onOpenChange={setCartOpen} />
      <AdminLoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}
