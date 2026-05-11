"use client";

import { useEffect, useMemo, useState } from "react";
import { MenuItem, OrderItem } from "@/lib/types";

type Cart = Record<string, number>;

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

  async function loadMenu() {
    const res = await fetch("/api/menu", { cache: "no-store" });
    const data = (await res.json()) as MenuItem[];
    setMenu(data.filter((item) => item.available));
  }

  useEffect(() => {
    loadMenu();
  }, []);

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
    <main className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12">
      <header className="fade-up mb-8 rounded-3xl border border-cafe/10 bg-paper/90 p-6 shadow-card md:p-10">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-tomate">Padaria Prime</p>
        <h1 className="mt-3 text-5xl leading-none md:text-7xl">Cardapio da Casa</h1>
        <p className="mt-4 max-w-2xl text-sm text-cafe/80 md:text-base">
          Selecione seus itens favoritos e envie o pedido em segundos. O painel administrativo recebe tudo
          em tempo real na area de pedidos.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {menu.map((item, index) => (
            <article
              key={item.id}
              className="fade-up overflow-hidden rounded-3xl border border-cafe/10 bg-paper shadow-card"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <img src={item.imageUrl} alt={item.name} className="h-40 w-full object-cover" />
              <div className="space-y-2 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-oliva">{item.category}</p>
                <h2 className="text-3xl leading-none">{item.name}</h2>
                <p className="min-h-12 text-sm text-cafe/75">{item.description}</p>
                <div className="flex items-center justify-between pt-2">
                  <strong className="text-xl">{currency(item.price)}</strong>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => removeItem(item.id)}
                      className="h-9 w-9 rounded-full border border-cafe/25 text-lg font-bold hover:bg-cafe/10"
                    >
                      -
                    </button>
                    <span className="w-7 text-center font-bold">{cart[item.id] || 0}</span>
                    <button
                      onClick={() => addItem(item.id)}
                      className="h-9 w-9 rounded-full bg-tomate text-lg font-bold text-white hover:brightness-95"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>

        <aside className="glass fade-up h-fit rounded-3xl border border-cafe/10 p-5 shadow-card">
          <h3 className="text-3xl">Seu Pedido</h3>
          <div className="mt-4 space-y-2 text-sm">
            {cartItems.length === 0 && <p className="text-cafe/70">Seu carrinho esta vazio.</p>}
            {cartItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-xl bg-white/80 px-3 py-2">
                <span>
                  {item.quantity}x {item.name}
                </span>
                <strong>{currency(item.quantity * item.price)}</strong>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl bg-cafe p-3 text-trigo">
            <p className="text-xs uppercase tracking-[0.14em]">Total</p>
            <p className="text-3xl font-bold">{currency(total)}</p>
          </div>

          <div className="mt-4 space-y-2">
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Seu nome ou mesa"
              className="w-full rounded-xl border border-cafe/20 bg-white px-3 py-2 outline-none ring-tomate/30 focus:ring"
            />
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observacoes do pedido"
              className="h-20 w-full resize-none rounded-xl border border-cafe/20 bg-white px-3 py-2 outline-none ring-tomate/30 focus:ring"
            />
          </div>

          <button
            onClick={submitOrder}
            disabled={loading}
            className="mt-4 w-full rounded-xl bg-gradient-to-r from-tomate to-mostarda px-4 py-3 font-bold text-white transition hover:brightness-95 disabled:opacity-60"
          >
            {loading ? "Enviando..." : "Confirmar Pedido"}
          </button>

          {message && <p className="mt-3 text-sm font-semibold text-cafe/85">{message}</p>}

          <a href="/admin" className="mt-5 block text-center text-xs font-bold uppercase tracking-[0.14em] text-cafe/60">
            Ir para Painel Admin
          </a>
        </aside>
      </section>
    </main>
  );
}
