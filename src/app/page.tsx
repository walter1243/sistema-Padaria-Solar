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
    <div className="flex h-screen flex-col bg-[#eef3fb] text-[#091426]">
      {/* Banner Capa */}
      <section
        className="relative h-44 w-full bg-cover bg-center"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1400&q=80')`,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[#041634]/85 via-[#0f3f91]/70 to-[#c81f2f]/75" />
        <div className="relative flex h-full flex-col items-center justify-center px-4 text-center text-white">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.28em]">Capa Solar Supermercado</p>
          <h1 className="mt-1 text-3xl leading-none">Padaria Solar</h1>
          <p className="mt-2 text-xs font-semibold text-white/90">Cardapio profissional com pedidos em tempo real</p>
        </div>
      </section>

      {/* Header + Busca em Card */}
      <section className="-mt-6 px-3 pb-3">
        <div className="rounded-2xl border border-[#d7e2f3] bg-white p-3 shadow-[0_10px_30px_rgba(15,63,145,0.14)]">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setShowDrawer(true)}
              className="rounded-xl border border-[#d8e1f0] bg-[#f7f9fe] p-2.5 text-[#0f3f91]"
              aria-label="Abrir menu"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <h2 className="text-xl text-[#0a1730]">Padaria Solar</h2>

            <button
              onClick={() => {
                setShowCart(true);
                setCartStep("items");
              }}
              className="relative rounded-xl border border-[#ffd4d8] bg-[#fff4f5] p-2.5 text-[#c81f2f]"
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
              className="w-full rounded-xl border-2 border-[#d2ddf0] bg-white px-4 py-2.5 text-sm font-semibold text-[#0a1730] outline-none placeholder:text-[#6a7790] focus:border-[#0f5bd4]"
            />
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-3 pb-6">
        {Object.entries(menuByCategory).map(([category, items]) =>
          items.length > 0 ? (
            <section key={category} className="mb-5 rounded-2xl border border-[#d9e3f1] bg-white p-2 shadow-[0_6px_22px_rgba(4,22,52,0.07)]">
              <div className="rounded-xl bg-gradient-to-r from-[#0f3f91] to-[#0f5bd4] px-3 py-2 text-white">
                <h3 className="text-xs font-extrabold uppercase tracking-[0.16em]">{category}</h3>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                {items.map((item) => (
                  <article key={item.id} className="overflow-hidden rounded-xl border border-[#dbe5f3] bg-[#fbfdff]">
                    <img src={item.imageUrl} alt={item.name} className="h-24 w-full object-cover" />
                    <div className="space-y-1 p-2">
                      <p className="line-clamp-1 text-[11px] font-bold uppercase tracking-wide text-[#0f5bd4]">{item.category}</p>
                      <h4 className="line-clamp-2 text-sm font-extrabold leading-tight text-[#0a1730]">{item.name}</h4>
                      <p className="line-clamp-1 text-[11px] text-[#5e6980]">{item.description}</p>
                      <div className="flex items-center justify-between pt-1">
                        <strong className="text-base font-black text-[#c81f2f]">{currency(item.price)}</strong>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => removeItem(item.id)}
                            className="h-7 w-7 rounded-full border border-[#cedaec] bg-white text-sm font-bold text-[#0f3f91]"
                          >
                            -
                          </button>
                          <span className="w-5 text-center text-xs font-bold text-[#0a1730]">{cart[item.id] || 0}</span>
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
            className="absolute inset-y-0 left-0 w-72 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#dce5f2] p-4">
              <h2 className="text-lg font-black text-[#0a1730]">Categorias</h2>
              <button onClick={() => setShowDrawer(false)} className="rounded-lg p-1 text-[#0f3f91] hover:bg-[#edf3ff]">
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
                    ? "border-[#c81f2f] bg-[#fff0f2] text-[#c81f2f]"
                    : "border-[#e0e8f3] text-[#0a1730] hover:bg-[#f3f7ff]"
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
                      ? "border-[#0f5bd4] bg-[#edf4ff] text-[#0f5bd4]"
                      : "border-[#e0e8f3] text-[#0a1730] hover:bg-[#f3f7ff]"
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
            className="w-full bg-white shadow-2xl"
            style={{ maxHeight: "90vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cart Header */}
            <div className="flex items-center justify-between border-b border-[#dce5f2] p-4">
              <h2 className="text-lg font-black text-[#0a1730]">Seu Pedido</h2>
              <button onClick={() => setShowCart(false)} className="rounded-lg p-1 text-[#0f3f91] hover:bg-[#edf3ff]">
                ✕
              </button>
            </div>

            {/* Step Indicator */}
            <div className="flex gap-2 border-b border-[#dce5f2] p-4">
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
                      : "bg-[#edf4ff] text-[#0f3f91]"
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
                      : "bg-[#edf4ff] text-[#0f3f91]"
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
                    <p className="text-center text-sm text-[#5e6980]">Carrinho vazio</p>
                  ) : (
                    cartItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-lg bg-[#f5f8ff] p-3">
                        <div className="flex-1">
                          <p className="text-sm font-bold text-[#0a1730]">{item.name}</p>
                          <p className="text-xs text-[#647087]">Quantidade: {item.quantity}</p>
                        </div>
                        <strong className="text-sm text-[#c81f2f]">{currency(item.quantity * item.price)}</strong>
                      </div>
                    ))
                  )}
                  {cartItems.length > 0 && (
                    <div className="mt-4 rounded-lg bg-[#edf4ff] p-3">
                      <div className="flex justify-between">
                        <span className="font-bold text-[#0a1730]">Total</span>
                        <span className="text-lg font-bold text-[#c81f2f]">{currency(total)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {cartStep === "info" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-[#5e6980]">Seu nome ou mesa *</label>
                    <input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Ex: Mesa 3"
                      className="mt-1 w-full rounded-lg border border-[#d2ddf0] bg-white px-3 py-2 text-sm outline-none focus:border-[#0f5bd4]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#5e6980]">Observações (opcional)</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Ex: Sem sal, extra crocante..."
                      className="mt-1 h-20 w-full resize-none rounded-lg border border-[#d2ddf0] bg-white px-3 py-2 text-sm outline-none focus:border-[#0f5bd4]"
                    />
                  </div>
                </div>
              )}

              {cartStep === "confirm" && (
                <div className="space-y-3">
                  <div className="rounded-lg bg-[#edf4ff] p-3">
                    <p className="text-xs font-bold text-[#5e6980]">Nome/Mesa</p>
                    <p className="mt-1 text-sm font-bold text-[#0a1730]">{customerName}</p>
                  </div>
                  <div className="rounded-lg bg-[#edf4ff] p-3">
                    <p className="text-xs font-bold text-[#5e6980]">Itens do Pedido</p>
                    <ul className="mt-2 space-y-1">
                      {cartItems.map((item) => (
                        <li key={item.id} className="flex justify-between text-sm text-[#0a1730]">
                          <span>{item.quantity}x {item.name}</span>
                          <span className="font-bold">{currency(item.quantity * item.price)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {notes && (
                    <div className="rounded-lg bg-[#edf4ff] p-3">
                      <p className="text-xs font-bold text-[#5e6980]">Obs</p>
                      <p className="mt-1 text-sm text-[#0a1730]">{notes}</p>
                    </div>
                  )}
                  <div className="rounded-lg border-t-2 border-[#c81f2f] bg-white p-3">
                    <div className="flex justify-between">
                      <span className="font-bold text-[#0a1730]">Total a Pagar</span>
                      <span className="text-2xl font-bold text-[#c81f2f]">{currency(total)}</span>
                    </div>
                  </div>
                </div>
              )}

              {message && (
                <div className="mt-3 rounded-lg bg-[#edf4ff] p-3">
                  <p className="text-center text-xs font-bold text-[#0a1730]">{message}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-[#dce5f2] p-4">
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
