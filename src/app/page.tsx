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
    <div className="flex h-screen flex-col bg-trigo">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-cafe/20 bg-paper px-4 py-3 shadow-sm">
        <button onClick={() => setShowDrawer(true)} className="rounded-lg p-2 hover:bg-cafe/10">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold text-cafe">Padaria Solar</h1>
        <button
          onClick={() => {
            setShowCart(true);
            setCartStep("items");
          }}
          className="relative rounded-lg p-2 hover:bg-cafe/10"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          {cartItems.length > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-tomate text-xs font-bold text-white">
              {cartItems.reduce((acc, item) => acc + item.quantity, 0)}
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
          className="w-full rounded-lg border border-cafe/25 bg-white px-4 py-2 text-sm font-medium outline-none placeholder:text-cafe/50 focus:ring-2 focus:ring-tomate/40"
        />
      </div>

      {/* Banner Capa */}
      <div
        className="relative h-40 bg-cover bg-center"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&w=1200&q=80')`,
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-cafe/85 via-tomate/75 to-tomate/70" />
        <div className="relative flex h-full flex-col items-center justify-center text-center">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-trigo">Bem-vindo à</p>
          <h1 className="mt-1 text-3xl font-bold text-trigo">Padaria Prime</h1>
          <p className="mt-1 text-xs text-trigo/95">Qualidade e frescor em cada pedido</p>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-trigo px-0 py-4">
        {Object.entries(menuByCategory).map(([category, items]) =>
          items.length > 0 ? (
            <section key={category} className="mb-6">
              {/* Category Header */}
              <div className="sticky top-0 border-b-2 border-cafe/30 bg-cafe/10 px-4 py-2">
                <h2 className="text-sm font-bold uppercase tracking-wider text-cafe">{category}</h2>
              </div>
              {/* Products Grid - 2 columns */}
              <div className="grid grid-cols-2 gap-2 px-2 py-3">
                {items.map((item) => (
                  <article key={item.id} className="overflow-hidden rounded-xl border border-cafe/15 bg-paper shadow-sm">
                    <img src={item.imageUrl} alt={item.name} className="h-24 w-full object-cover" />
                    <div className="space-y-1 p-2">
                      <h3 className="line-clamp-1 text-xs font-bold text-cafe">{item.name}</h3>
                      <p className="line-clamp-1 text-xs text-cafe/65">{item.description}</p>
                      <div className="flex items-center justify-between pt-1">
                        <strong className="text-xs text-tomate">{currency(item.price)}</strong>
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={() => removeItem(item.id)}
                            className="h-6 w-6 rounded-full border border-cafe/25 text-xs font-bold hover:bg-cafe/10"
                          >
                            −
                          </button>
                          <span className="w-4 text-center text-xs font-bold">{cart[item.id] || 0}</span>
                          <button
                            onClick={() => addItem(item.id)}
                            className="h-6 w-6 rounded-full bg-tomate text-xs font-bold text-white hover:brightness-95"
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
        <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowDrawer(false)}>
          <div
            className="absolute inset-y-0 left-0 w-64 bg-paper shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-cafe/15 p-4">
              <h2 className="text-lg font-bold">Categorias</h2>
              <button onClick={() => setShowDrawer(false)} className="rounded-lg p-1 hover:bg-cafe/10">
                ✕
              </button>
            </div>
            <nav className="space-y-1 p-3">
              <button
                onClick={() => {
                  setSelectedCategory(null);
                  setShowDrawer(false);
                }}
                className={`w-full rounded-lg px-4 py-3 text-left text-sm font-bold transition ${
                  !selectedCategory ? "bg-tomate/20 text-tomate" : "text-cafe hover:bg-cafe/10"
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
                  className={`w-full rounded-lg px-4 py-3 text-left text-sm font-bold transition ${
                    selectedCategory === cat ? "bg-tomate/20 text-tomate" : "text-cafe hover:bg-cafe/10"
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
        <div className="fixed inset-0 z-40 flex items-end bg-black/40" onClick={() => setShowCart(false)}>
          <div
            className="w-full bg-paper shadow-2xl"
            style={{ maxHeight: "90vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cart Header */}
            <div className="flex items-center justify-between border-b border-cafe/15 p-4">
              <h2 className="text-lg font-bold">Seu Pedido</h2>
              <button onClick={() => setShowCart(false)} className="rounded-lg p-1 hover:bg-cafe/10">
                ✕
              </button>
            </div>

            {/* Step Indicator */}
            <div className="flex gap-2 border-b border-cafe/15 p-4">
              <button
                onClick={() => setCartStep("items")}
                className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
                  cartStep === "items" ? "bg-tomate text-white" : "bg-cafe/10 text-cafe"
                }`}
              >
                Itens
              </button>
              <button
                onClick={() => cartItems.length > 0 && setCartStep("info")}
                disabled={cartItems.length === 0}
                className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
                  cartStep === "info"
                    ? "bg-tomate text-white"
                    : cartItems.length === 0
                      ? "bg-cafe/5 text-cafe/40"
                      : "bg-cafe/10 text-cafe"
                }`}
              >
                Info
              </button>
              <button
                onClick={() => customerName.trim() && setCartStep("confirm")}
                disabled={!customerName.trim()}
                className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
                  cartStep === "confirm"
                    ? "bg-tomate text-white"
                    : !customerName.trim()
                      ? "bg-cafe/5 text-cafe/40"
                      : "bg-cafe/10 text-cafe"
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
                    <p className="text-center text-sm text-cafe/60">Carrinho vazio</p>
                  ) : (
                    cartItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-lg bg-cafe/5 p-3">
                        <div className="flex-1">
                          <p className="text-sm font-bold text-cafe">{item.name}</p>
                          <p className="text-xs text-cafe/70">Quantidade: {item.quantity}</p>
                        </div>
                        <strong className="text-sm text-tomate">{currency(item.quantity * item.price)}</strong>
                      </div>
                    ))
                  )}
                  {cartItems.length > 0 && (
                    <div className="mt-4 rounded-lg bg-cafe/10 p-3">
                      <div className="flex justify-between">
                        <span className="font-bold text-cafe">Total</span>
                        <span className="text-lg font-bold text-tomate">{currency(total)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {cartStep === "info" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-cafe/70">Seu nome ou mesa *</label>
                    <input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Ex: Mesa 3"
                      className="mt-1 w-full rounded-lg border border-cafe/20 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-tomate/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-cafe/70">Observações (opcional)</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Ex: Sem sal, extra crocante..."
                      className="mt-1 h-20 w-full resize-none rounded-lg border border-cafe/20 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-tomate/30"
                    />
                  </div>
                </div>
              )}

              {cartStep === "confirm" && (
                <div className="space-y-3">
                  <div className="rounded-lg bg-cafe/10 p-3">
                    <p className="text-xs font-bold text-cafe/70">Nome/Mesa</p>
                    <p className="mt-1 text-sm font-bold text-cafe">{customerName}</p>
                  </div>
                  <div className="rounded-lg bg-cafe/10 p-3">
                    <p className="text-xs font-bold text-cafe/70">Itens do Pedido</p>
                    <ul className="mt-2 space-y-1">
                      {cartItems.map((item) => (
                        <li key={item.id} className="flex justify-between text-sm text-cafe">
                          <span>{item.quantity}x {item.name}</span>
                          <span className="font-bold">{currency(item.quantity * item.price)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {notes && (
                    <div className="rounded-lg bg-cafe/10 p-3">
                      <p className="text-xs font-bold text-cafe/70">Obs</p>
                      <p className="mt-1 text-sm text-cafe">{notes}</p>
                    </div>
                  )}
                  <div className="rounded-lg border-t-2 border-tomate bg-white p-3">
                    <div className="flex justify-between">
                      <span className="font-bold text-cafe">Total a Pagar</span>
                      <span className="text-2xl font-bold text-tomate">{currency(total)}</span>
                    </div>
                  </div>
                </div>
              )}

              {message && (
                <div className="mt-3 rounded-lg bg-cafe/10 p-3">
                  <p className="text-xs font-bold text-cafe text-center">{message}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-cafe/15 p-4">
              {cartStep === "items" && (
                <button
                  onClick={() => cartItems.length > 0 && setCartStep("info")}
                  disabled={cartItems.length === 0}
                  className="w-full rounded-lg bg-tomate px-4 py-3 font-bold text-white transition hover:brightness-95 disabled:opacity-50"
                >
                  Continuar
                </button>
              )}
              {cartStep === "info" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setCartStep("items")}
                    className="flex-1 rounded-lg border border-cafe/20 px-4 py-3 font-bold text-cafe transition hover:bg-cafe/10"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={() => setCartStep("confirm")}
                    className="flex-1 rounded-lg bg-tomate px-4 py-3 font-bold text-white transition hover:brightness-95"
                  >
                    Revisar
                  </button>
                </div>
              )}
              {cartStep === "confirm" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setCartStep("info")}
                    className="flex-1 rounded-lg border border-cafe/20 px-4 py-3 font-bold text-cafe transition hover:bg-cafe/10"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={submitOrder}
                    disabled={loading}
                    className="flex-1 rounded-lg bg-gradient-to-r from-tomate to-mostarda px-4 py-3 font-bold text-white transition hover:brightness-95 disabled:opacity-50"
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
