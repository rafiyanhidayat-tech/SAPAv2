import { ArrowRight, Sparkles } from "lucide-react";
import { useApp } from "../context/AppContext";
import { fileUrl } from "../lib/api";
import { Button } from "../components/ui/button";

export default function Hero() {
  const { settings } = useApp();
  const title = settings?.hero_title || "";
  const subtitle = settings?.hero_subtitle || "";
  const image = fileUrl(settings?.hero_image);

  return (
    <section className="relative min-h-[92vh] flex items-center overflow-hidden">
      <div className="absolute inset-0">
        <img
          src={image}
          alt="Ballroom"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-slate-900/45" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/70 to-slate-900/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-slate-900/20" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 w-full pt-24">
        <div className="max-w-3xl animate-fade-up">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-400 text-xs uppercase tracking-[0.25em]">
            <Sparkles className="h-3.5 w-3.5" />
            Venue Premium Panti Sosial
          </span>
          <h1
            data-testid="hero-title"
            className="mt-6 font-serif text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-slate-50 leading-[1.05]"
          >
            {title}
          </h1>
          <p
            data-testid="hero-subtitle"
            className="mt-6 text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl"
          >
            {subtitle}
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Button
              data-testid="hero-cta"
              onClick={() => document.getElementById("katalog")?.scrollIntoView({ behavior: "smooth" })}
              className="rounded-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-8 h-12 hover:-translate-y-1 transition-transform duration-300"
            >
              Jelajahi Ruangan
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
