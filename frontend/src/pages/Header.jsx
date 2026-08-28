import { ShoppingCart, Menu } from "lucide-react";
import { useApp } from "../context/AppContext";
import { Button } from "../components/ui/button";

export default function Header({ onOpenCart, onOpenAdmin }) {
  const { cart } = useApp();
  const count = cart.length;

  return (
    <header
      data-testid="site-header"
      className="fixed top-0 left-0 right-0 z-40 bg-slate-900/80 backdrop-blur-xl border-b border-white/10"
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-8 h-20 flex items-center justify-between">
        <button
          data-testid="admin-logo-btn"
          onClick={onOpenAdmin}
          title="Akses Admin"
          className="flex items-center gap-3 group"
        >
          <span className="grid place-items-center h-11 w-11 rounded-full bg-amber-500 text-slate-900 font-serif text-xl font-black shadow-[0_8px_24px_rgba(245,158,11,0.35)] group-hover:scale-105 transition-transform duration-300">
            S
          </span>
          <span className="text-left leading-tight">
            <span className="block font-serif text-3xl text-amber-500 font-medium tracking-tight">
              Sapa-Panti Sosial
            </span>
            <span className="hidden sm:block text-[10px] uppercase tracking-[0.3em] text-slate-400">
              Pemprov Kalimantan Utara
            </span>
          </span>
        </button>

        <nav className="flex items-center gap-2 sm:gap-4">
          <a
            href="#katalog"
            data-testid="nav-beranda"
            className="hidden sm:inline text-sm text-slate-300 hover:text-amber-400 transition-colors px-3 py-2"
          >
            Beranda
          </a>
          <a
            href="#katalog"
            data-testid="nav-katalog"
            className="hidden sm:inline text-sm text-slate-300 hover:text-amber-400 transition-colors px-3 py-2"
          >
            Katalog
          </a>
          <Button
            data-testid="open-cart-btn"
            onClick={onOpenCart}
            variant="secondary"
            className="relative rounded-full bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700"
          >
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline ml-2">Keranjang</span>
            {count > 0 && (
              <span
                data-testid="cart-badge"
                className="absolute -top-2 -right-2 h-6 min-w-6 px-1 grid place-items-center rounded-full bg-amber-500 text-slate-900 text-xs font-bold"
              >
                {count}
              </span>
            )}
          </Button>
        </nav>
      </div>
    </header>
  );
}
