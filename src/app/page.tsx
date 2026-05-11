"use client";

import { useEffect, useMemo, useState } from "react";
import { MenuItem, MenuCategory, OrderItem } from "@/lib/types";

type Cart = Record<string, number>;

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
      const matchesSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [menu, selectedCategory, searchQuery]);

  const cartItems = useMemo(() => {
    return menu
      .filter((item) => cart[item.id] > 0)
      .map((item) => ({ ...item, quantity: cart[item.id] }));
  }, [cart, menu]);

  const total = useMemo(
    () => cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0),
    [cartItems],
  );

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

      setMessage("Pedido enviado com sucesso. A cozinha ja recebeu.");
      setCart({});
      setNotes("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen flex-col bg-trigo">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-cafe/15 bg-paper px-4 py-3 shadow-sm">
        <button
          onClick={() => setShowDrawer(true)}
          className="rounded-lg p-2 hover:bg-cafe/10"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <h1 className="text-2xl font-bold text-cafe">Padaria Prime</h1>

        <button
          onClick={() => setShowCart(true)}
          className="relative rounded-lg p-2 hover:bg-cafe/10"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          {cartItems.length > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-tomate text-xs font-bold text-white">
              {cartItems.length}
            </span>
          )}
        </button>
      </header>

      {/* Search Bar */}
      <div className="border-b border-cafe/15 bg-paper px-4 py-3">
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar produto..."
          className="w-full rounded-lg border border-cafe/20 bg-white px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-tomate/30"
        />
      </div>

      {/* Banner Capa */}
      <div
        className="relative h-48 bg-cover bg-center"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&w=1200&q=80')`,
          backgroundAttachment: "fixed",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-cafe/90 to-tomate/80" />
        <div className="relative flex h-full flex-col items-center justify-center text-center">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-trigo">Bem-vindo à</p>
          <h1 className="mt-2 text-4xl font-bold text-trigo drop-shadow-lg">Padaria Prime</h1>
          <p className="mt-2 text-sm text-trigo/90">Qualidade e frescor em cada pedido</p>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-4 py-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredMenu.map((item) => (
            <article key={item.id} className="overflow-hidden rounded-2xl border border-cafe/15 bg-paper shadow-sm">
              <img src={item.imageUrl} alt={item.name} className="h-32 w-full object-cover" />
              <div className="space-y-1 p-3">
                <p className="text-xs font-bold uppercase tracking-widest text-oliva">{item.category}</p>
                <h2 className="line-clamp-1 text-lg leading-tight">{item.name}</h2>
                <p className="line-clamp-2 text-xs text-cafe/70">{item.description}</p>
                <div className="flex items-center justify-between pt-2">
                  <strong className="text-sm">{currency(item.price)}</strong>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => removeItem(item.id)}
                      className="h-7 w-7 rounded-full border border-cafe/25 text-sm font-bold hover:bg-cafe/10"
                    >
                      −
                    </button>
                    <span className="w-5 text-center text-xs font-bold">{cart[item.id] || 0}</span>
                    <button
                      onClick={() => addItem(item.id)}
                      className="h-7 w-7 rounded-full bg-tomate text-sm font-bold text-white hover:brightness-95"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
        {filteredMenu.length === 0 && (
          <div className="flex h-40 items-center justify-center">
            <p className="text-center text-sm text-cafe/60">Nenhum produto encontrado</p>
          </div>
        )}
      </main>

      {/* Category Drawer */}
      {showDrawer && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={() => setShowDrawer(false)}
        >
          <div
            className="absolute inset-y-0 left-0 w-64 bg-paper shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-cafe/15 p-4">
              <h2 className="text-xl font-bold">Categorias</h2>
              <button
                onClick={() => setShowDrawer(false)}
                className="rounded-lg p-1 hover:bg-cafe/10"
              >
                ✕
              </button>
            </div>
            <nav className="space-y-1 p-4">
              <button
                onClick={() => {
                  setSelectedCategory(null);
                  setShowDrawer(false);
                }}
                className={`w-full rounded-lg px-4 py-3 text-left font-bold transition ${
                  !selectedCategory
                    ? "bg-tomate/20 text-tomate"
                    : "text-cafe hover:bg-cafe/10"
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
                  className={`w-full rounded-lg px-4 py-3 text-left font-bold transition ${
                    selectedCategory === cat
                      ? "bg-tomate/20 text-tomate"
                      : "text-cafe hover:bg-cafe/10"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Cart Drawer */}
      {showCart && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={() => setShowCart(false)}
        >
          <div
            className="absolute inset-y-0 right-0 w-full max-w-sm bg-paper shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-cafe/15 p-4">
              <h2 className="text-xl font-bold">Seu Pedido</h2>
              <button
                onClick={() => setShowCart(false)}
                className="rounded-lg p-1 hover:bg-cafe/10"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-1 flex-col overflow-y-auto p-4">
              <div className="space-y-2">
                {cartItems.length === 0 && (
                  <p className="text-center text-sm text-cafe/60">Carrinho vazio</p>
                )}
                {cartItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-lg bg-cafe/5 p-2">
                    <div className="flex-1">
                      <p className="text-sm font-bold">{item.name}</p>
                      <p className="text-xs text-cafe/70">{item.quantity}x</p>
                    </div>
                    <strong className="text-sm">{currency(item.quantity * item.price)}</strong>
                  </div>
                ))}
              </div>

              {cartItems.length > 0 && (
                <div className="mt-4 space-y-3">
                  <div className="rounded-lg border-t border-cafe/15 pt-3">
                    <div className="flex justify-between text-sm font-bold">
                      <span>Total</span>
                      <span>{currency(total)}</span>
                    </div>
                  </div>

                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Seu nome ou mesa"
                    className="w-full rounded-lg border border-cafe/20 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-tomate/30"
                  />

                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Obs do pedido"
                    className="h-16 w-full resize-none rounded-lg border border-cafe/20 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-tomate/30"
                  />

                  <button
                    onClick={submitOrder}
                    disabled={loading}
                    className="w-full rounded-lg bg-gradient-to-r from-tomate to-mostarda px-4 py-3 font-bold text-white transition hover:brightness-95 disabled:opacity-60"
                  >
                    {loading ? "Enviando..." : "Confirmar Pedido"}
                  </button>

                  {message && <p className="rounded-lg bg-cafe/10 p-2 text-xs font-semibold text-cafe">{message}</p>}
                </div>
              )}
            </div>

            <div className="border-t border-cafe/15 p-4">
              <a
                href="/admin"
                className="block text-center text-xs font-bold uppercase tracking-widest text-cafe/60 hover:text-cafe"
              >
                Painel Admin
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
