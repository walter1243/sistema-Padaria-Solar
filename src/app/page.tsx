"use client";

import { useEffect, useMemo, useState } from "react";
import { MenuItem, MenuCategory, OrderItem } from "@/lib/types";

type Cart = Record<string, number>;
type CartStep = "items" | "info" | "confirm";

const CATEGORIES: MenuCategory[] = ["Salgado", "Lanche", "Bebida", "Doce"];

function currency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default function HomePage() {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<Cart>({});
  const [customerName, setCustomerName] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showDrawer, setShowDrawer] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<MenuCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCart, setShowCart] = useState(false);
  const [cartStep, setCartStep] = useState<CartStep>("items");

  async function loadMenu() {
    const res = await fetch("/api/menu", { cache: "no-store" });
    const data = (await res.json()) as MenuItem[];
    setMenu(data.filter((item) => item.available));
  }

  useEffect(() => {
    loadMenu();
  }, []);

  const filteredMenu = useMemo(() => {
    return menu.filter((item) => {
      const matchesCategory = !selectedCategory || item.category === selectedCategory;
      const matchesSearch =
        !searchQuery ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [menu, selectedCategory, searchQuery]);

  const menuByCategory = useMemo(() => {
    const grouped: Record<MenuCategory, MenuItem[]> = {
      Salgado: [],
      Lanche: [],
      Bebida: [],
      Doce: [],
    };
    filteredMenu.forEach((item) => {
      grouped[item.category].push(item);
    });
    return grouped;
  }, [filteredMenu]);

  const cartItems = useMemo(() => {
    return menu
      .filter((item) => cart[item.id] > 0)
      .map((item) => ({ ...item, quantity: cart[item.id] }));
  }, [cart, menu]);

  const total = useMemo(() => cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0), [cartItems]);

  function addItem(id: string) {
    setCart((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  }

  function removeItem(id: string) {
    setCart((prev) => {
      const next = { ...prev };
      next[id] = Math.max((next[id] || 1) - 1, 0);
      if (next[id] === 0) delete next[id];
      return next;
    });
  }

  async function submitOrder() {
    setMessage("");
    if (!customerName.trim()) {
      setMessage("Digite seu nome ou identificacao da mesa.");
      return;
    }

    if (cartItems.length === 0) {
      setMessage("Adicione pelo menos um item no pedido.");
      return;
    }

    const items: OrderItem[] = cartItems.map((item) => ({
      itemId: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
    }));

    try {
      setLoading(true);
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          notes,
          items,
        }),
      });

      if (!res.ok) {
        setMessage("Nao foi possivel enviar o pedido.");
        return;
      }

      setMessage("Pedido enviado com sucesso! Seu pedido está na cozinha.");
      setCart({});
      setNotes("");
      setShowCart(false);
      setCartStep("items");
      setTimeout(() => setMessage(""), 3000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen flex-col bg-[#060b14] text-[#eef4ff]">
      {/* Banner Capa */}
      <section
        className="relative h-48 w-full bg-cover bg-center"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1400&q=80')`,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[#020918]/90 via-[#0d2e70]/80 to-[#8f1722]/80" />
        <div className="relative flex h-full flex-col items-center justify-center px-4 text-center text-white">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/60 bg-[#0a1a37]/65 text-lg font-bold shadow-lg">
            PS
          </div>
          <h1 className="mt-3 text-4xl font-light tracking-[0.08em]" style={{ fontFamily: "var(--font-body)" }}>
            Padaria Solar
          </h1>
        </div>
      </section>

      {/* Header + Busca em Card */}
      <section className="-mt-6 px-3 pb-3">
        <div className="rounded-2xl border border-[#1e2e48] bg-[#0b1424] p-3 shadow-[0_10px_30px_rgba(0,0,0,0.45)]">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setShowDrawer(true)}
              className="rounded-xl border border-[#2c456d] bg-[#13233f] p-2.5 text-[#77a5ff]"
              aria-label="Abrir menu"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="h-6" />

            <button
              onClick={() => {
                setShowCart(true);
                setCartStep("items");
              }}
              className="relative rounded-xl border border-[#2c456d] bg-[#13233f] p-2.5 text-[#ff5b6a]"
              aria-label="Abrir carrinho"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.1} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {cartItems.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#c81f2f] px-1 text-[10px] font-bold text-white">
                  {cartItems.reduce((acc, item) => acc + item.quantity, 0)}
                </span>
              )}
            </button>
          </div>

          <div className="mt-3">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar produto..."
              className="w-full rounded-xl border-2 border-[#2e476f] bg-[#091426] px-4 py-2.5 text-sm font-semibold text-[#e8f1ff] outline-none placeholder:text-[#8ca6cd] focus:border-[#0f5bd4]"
            />
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-3 pb-6">
        {Object.entries(menuByCategory).map(([category, items]) =>
          items.length > 0 ? (
            <section key={category} className="mb-5 rounded-2xl border border-[#1f314f] bg-[#0b1424] p-2 shadow-[0_6px_22px_rgba(0,0,0,0.45)]">
              <div className="rounded-xl bg-gradient-to-r from-[#0f3f91] to-[#0f5bd4] px-3 py-2 text-white">
                <h3 className="text-xs font-extrabold uppercase tracking-[0.16em]">{category}</h3>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                {items.map((item) => (
                  <article key={item.id} className="overflow-hidden rounded-xl border border-[#213554] bg-[#0f1b30]">
                    <img src={item.imageUrl} alt={item.name} className="h-24 w-full object-cover" />
                    <div className="space-y-1 p-2">
                      <p className="line-clamp-1 text-[11px] font-bold uppercase tracking-wide text-[#0f5bd4]">{item.category}</p>
                      <h4 className="line-clamp-2 text-sm font-extrabold leading-tight text-[#f2f7ff]">{item.name}</h4>
                      <p className="line-clamp-1 text-[11px] text-[#9bb0d0]">{item.description}</p>
                      <div className="flex items-center justify-between pt-1">
                        <strong className="text-base font-black text-[#c81f2f]">{currency(item.price)}</strong>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => removeItem(item.id)}
                            className="h-7 w-7 rounded-full border border-[#2f466d] bg-[#13233f] text-sm font-bold text-[#8db5ff]"
                          >
                            -
                          </button>
                          <span className="w-5 text-center text-xs font-bold text-[#e9f1ff]">{cart[item.id] || 0}</span>
                          <button
                            onClick={() => addItem(item.id)}
                            className="h-7 w-7 rounded-full bg-[#0f5bd4] text-sm font-bold text-white"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null,
        )}
      </main>

      {/* Category Drawer */}
      {showDrawer && (
        <div className="fixed inset-0 z-40 bg-[#020817]/50" onClick={() => setShowDrawer(false)}>
          <div
            className="absolute inset-y-0 left-0 w-72 bg-[#0b1424] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#1f314f] p-4">
              <h2 className="text-lg font-black text-[#eef4ff]">Categorias</h2>
              <button onClick={() => setShowDrawer(false)} className="rounded-lg p-1 text-[#8db5ff] hover:bg-[#13233f]">
                ✕
              </button>
            </div>
            <nav className="space-y-1 p-3">
              <button
                onClick={() => {
                  setSelectedCategory(null);
                  setShowDrawer(false);
                }}
                className={`w-full rounded-xl border px-4 py-3 text-left text-sm font-bold transition ${
                  !selectedCategory
                    ? "border-[#c81f2f] bg-[#35131a] text-[#ff6b78]"
                    : "border-[#2b4062] text-[#e6f0ff] hover:bg-[#13233f]"
                }`}
              >
                Todos
              </button>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setSelectedCategory(cat);
                    setShowDrawer(false);
                  }}
                  className={`w-full rounded-xl border px-4 py-3 text-left text-sm font-bold transition ${
                    selectedCategory === cat
                      ? "border-[#0f5bd4] bg-[#112849] text-[#8db5ff]"
                      : "border-[#2b4062] text-[#e6f0ff] hover:bg-[#13233f]"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Cart Modal */}
      {showCart && (
        <div className="fixed inset-0 z-40 flex items-end bg-[#020817]/50" onClick={() => setShowCart(false)}>
          <div
            className="w-full bg-[#0b1424] shadow-2xl"
            style={{ maxHeight: "90vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cart Header */}
            <div className="flex items-center justify-between border-b border-[#1f314f] p-4">
              <h2 className="text-lg font-black text-[#eef4ff]">Seu Pedido</h2>
              <button onClick={() => setShowCart(false)} className="rounded-lg p-1 text-[#8db5ff] hover:bg-[#13233f]">
                ✕
              </button>
            </div>

            {/* Step Indicator */}
            <div className="flex gap-2 border-b border-[#1f314f] p-4">
              <button
                onClick={() => setCartStep("items")}
                className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
                  cartStep === "items" ? "bg-[#c81f2f] text-white" : "bg-[#edf4ff] text-[#0f3f91]"
                }`}
              >
                Itens
              </button>
              <button
                onClick={() => cartItems.length > 0 && setCartStep("info")}
                disabled={cartItems.length === 0}
                className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
                  cartStep === "info"
                    ? "bg-[#c81f2f] text-white"
                    : cartItems.length === 0
                      ? "bg-[#f1f4f9] text-[#93a0b8]"
                      : "bg-[#13233f] text-[#8db5ff]"
                }`}
              >
                Info
              </button>
              <button
                onClick={() => customerName.trim() && setCartStep("confirm")}
                disabled={!customerName.trim()}
                className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
                  cartStep === "confirm"
                    ? "bg-[#c81f2f] text-white"
                    : !customerName.trim()
                      ? "bg-[#f1f4f9] text-[#93a0b8]"
                      : "bg-[#13233f] text-[#8db5ff]"
                }`}
              >
                Confirmar
              </button>
            </div>

            {/* Content by Step */}
            <div className="flex-1 overflow-y-auto p-4">
              {cartStep === "items" && (
                <div className="space-y-3">
                  {cartItems.length === 0 ? (
                    <p className="text-center text-sm text-[#9bb0d0]">Carrinho vazio</p>
                  ) : (
                    cartItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-lg bg-[#13233f] p-3">
                        <div className="flex-1">
                          <p className="text-sm font-bold text-[#eef4ff]">{item.name}</p>
                          <p className="text-xs text-[#9bb0d0]">Quantidade: {item.quantity}</p>
                        </div>
                        <strong className="text-sm text-[#c81f2f]">{currency(item.quantity * item.price)}</strong>
                      </div>
                    ))
                  )}
                  {cartItems.length > 0 && (
                    <div className="mt-4 rounded-lg bg-[#13233f] p-3">
                      <div className="flex justify-between">
                        <span className="font-bold text-[#eef4ff]">Total</span>
                        <span className="text-lg font-bold text-[#c81f2f]">{currency(total)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {cartStep === "info" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-[#9bb0d0]">Seu nome ou mesa *</label>
                    <input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Ex: Mesa 3"
                      className="mt-1 w-full rounded-lg border border-[#2e476f] bg-[#091426] px-3 py-2 text-sm text-[#eef4ff] outline-none focus:border-[#0f5bd4]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#9bb0d0]">Observações (opcional)</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Ex: Sem sal, extra crocante..."
                      className="mt-1 h-20 w-full resize-none rounded-lg border border-[#2e476f] bg-[#091426] px-3 py-2 text-sm text-[#eef4ff] outline-none focus:border-[#0f5bd4]"
                    />
                  </div>
                </div>
              )}

              {cartStep === "confirm" && (
                <div className="space-y-3">
                  <div className="rounded-lg bg-[#13233f] p-3">
                    <p className="text-xs font-bold text-[#9bb0d0]">Nome/Mesa</p>
                    <p className="mt-1 text-sm font-bold text-[#eef4ff]">{customerName}</p>
                  </div>
                  <div className="rounded-lg bg-[#13233f] p-3">
                    <p className="text-xs font-bold text-[#9bb0d0]">Itens do Pedido</p>
                    <ul className="mt-2 space-y-1">
                      {cartItems.map((item) => (
                        <li key={item.id} className="flex justify-between text-sm text-[#eef4ff]">
                          <span>{item.quantity}x {item.name}</span>
                          <span className="font-bold">{currency(item.quantity * item.price)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {notes && (
                    <div className="rounded-lg bg-[#13233f] p-3">
                      <p className="text-xs font-bold text-[#9bb0d0]">Obs</p>
                      <p className="mt-1 text-sm text-[#eef4ff]">{notes}</p>
                    </div>
                  )}
                  <div className="rounded-lg border-t-2 border-[#c81f2f] bg-[#091426] p-3">
                    <div className="flex justify-between">
                      <span className="font-bold text-[#eef4ff]">Total a Pagar</span>
                      <span className="text-2xl font-bold text-[#c81f2f]">{currency(total)}</span>
                    </div>
                  </div>
                </div>
              )}

              {message && (
                <div className="mt-3 rounded-lg bg-[#13233f] p-3">
                  <p className="text-center text-xs font-bold text-[#eaf2ff]">{message}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-[#1f314f] p-4">
              {cartStep === "items" && (
                <button
                  onClick={() => cartItems.length > 0 && setCartStep("info")}
                  disabled={cartItems.length === 0}
                  className="w-full rounded-lg bg-[#c81f2f] px-4 py-3 font-bold text-white transition hover:brightness-95 disabled:opacity-50"
                >
                  Continuar
                </button>
              )}
              {cartStep === "info" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setCartStep("items")}
                    className="flex-1 rounded-lg border border-[#d2ddf0] px-4 py-3 font-bold text-[#0f3f91] transition hover:bg-[#edf4ff]"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={() => setCartStep("confirm")}
                    className="flex-1 rounded-lg bg-[#0f5bd4] px-4 py-3 font-bold text-white transition hover:brightness-95"
                  >
                    Revisar
                  </button>
                </div>
              )}
              {cartStep === "confirm" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setCartStep("info")}
                    className="flex-1 rounded-lg border border-[#d2ddf0] px-4 py-3 font-bold text-[#0f3f91] transition hover:bg-[#edf4ff]"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={submitOrder}
                    disabled={loading}
                    className="flex-1 rounded-lg bg-gradient-to-r from-[#c81f2f] to-[#0f5bd4] px-4 py-3 font-bold text-white transition hover:brightness-95 disabled:opacity-50"
                  >
                    {loading ? "Enviando..." : "Confirmar Pedido"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
