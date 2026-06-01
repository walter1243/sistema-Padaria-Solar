"use client";

import { useEffect, useMemo, useState } from "react";
import { MenuItem } from "@/lib/types";

function currency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default function CardapioPage() {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("Todos");

  useEffect(() => {
    fetch("/api/menu")
      .then((r) => r.json())
      .then((data: MenuItem[]) => {
        setMenu(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(menu.map((item) => item.category))).sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    );
    return ["Todos", ...cats];
  }, [menu]);

  const filtered = useMemo(() => {
    if (activeCategory === "Todos") return menu;
    return menu.filter((item) => item.category === activeCategory);
  }, [menu, activeCategory]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#060b14]">
        <p className="animate-pulse text-sm font-semibold uppercase tracking-[0.14em] text-[#8db5ff]">
          Carregando cardápio...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#060b14] text-[#eef4ff]">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-[#1e3254] bg-[#060b14]/95 px-4 py-4 backdrop-blur-md">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white">Padaria Solar</h1>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8db5ff]">
              Cardápio Digital
            </p>
          </div>
          <span className="rounded-full border border-[#2a4162] bg-[#0b1424] px-3 py-1 text-xs font-bold text-[#8db5ff]">
            {menu.length} produtos
          </span>
        </div>
      </header>

      {/* Category filter pills */}
      <div className="sticky top-[73px] z-10 border-b border-[#1e3254] bg-[#060b14]/95 backdrop-blur-md">
        <div className="mx-auto max-w-5xl overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 px-4 py-3">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                  activeCategory === cat
                    ? "bg-gradient-to-r from-[#c81f2f] to-[#0f5bd4] text-white shadow-lg"
                    : "border border-[#2a4162] bg-[#0b1424] text-[#8db5ff] hover:bg-[#13233f]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Product grid */}
      <div className="mx-auto max-w-5xl px-4 py-6">
        {filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-[#8db5ff]">Nenhum produto encontrado.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map((item) => (
              <article
                key={item.id}
                className="overflow-hidden rounded-2xl border border-[#2a4162] bg-[#0b1424] transition-transform active:scale-[0.98]"
              >
                {/* Image */}
                <div className="aspect-square overflow-hidden bg-[#101d33]">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <span className="text-4xl opacity-30">🍞</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3">
                  <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#8db5ff]">
                    {item.category}
                  </span>
                  <h2 className="mt-0.5 line-clamp-2 text-sm font-bold leading-tight text-white">
                    {item.name}
                  </h2>
                  {item.description && (
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#93a8c6]">
                      {item.description}
                    </p>
                  )}
                  <p className="mt-2 text-sm font-black text-[#8db5ff]">
                    {currency(item.price)}
                  </p>
                  {item.addons && item.addons.length > 0 && (
                    <p className="mt-1 text-[10px] text-[#6a88af]">
                      +{item.addons.length} acompanhamento{item.addons.length > 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-8 border-t border-[#1e3254] bg-[#0b1424] px-4 py-8 text-center">
        <p className="text-sm font-bold text-[#d6e3f8]">
          📱 Escaneie o QR code da sua mesa para fazer seu pedido
        </p>
        <p className="mt-2 text-xs text-[#5a7aaa]">
          Padaria Solar &bull; Todos os produtos
        </p>
      </footer>
    </main>
  );
}
