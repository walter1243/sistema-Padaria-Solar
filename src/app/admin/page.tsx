"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { MenuCategory, MenuItem, Order, OrderStatus } from "@/lib/types";

const statusFlow: OrderStatus[] = ["novo", "preparando", "pronto", "entregue"];

function currency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function statusLabel(status: OrderStatus) {
  const map: Record<OrderStatus, string> = {
    novo: "Novo",
    preparando: "Preparando",
    pronto: "Pronto",
    entregue: "Entregue",
  };
  return map[status];
}

export default function AdminPage() {
  const [pin, setPin] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState("");
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [refreshTick, setRefreshTick] = useState(0);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState<MenuCategory>("Salgado");
  const [imageUrl, setImageUrl] = useState("");
  const [addonsText, setAddonsText] = useState("");

  const expectedPin = process.env.NEXT_PUBLIC_ADMIN_PIN || "1234";

  async function loadData() {
    const [menuRes, ordersRes] = await Promise.all([
      fetch("/api/menu", { cache: "no-store" }),
      fetch("/api/orders", { cache: "no-store" }),
    ]);

    const menuData = (await menuRes.json()) as MenuItem[];
    const orderData = (await ordersRes.json()) as Order[];
    setMenu(menuData);
    setOrders(orderData);
  }

  useEffect(() => {
    if (!authorized) return;
    loadData();
    const timer = setInterval(() => setRefreshTick((v) => v + 1), 6000);
    return () => clearInterval(timer);
  }, [authorized]);

  useEffect(() => {
    if (authorized) loadData();
  }, [authorized, refreshTick]);

  const groupedOrders = useMemo(() => {
    return statusFlow.map((status) => ({
      status,
      items: orders.filter((order) => order.status === status),
    }));
  }, [orders]);

  function login(e: FormEvent) {
    e.preventDefault();
    if (pin === expectedPin) {
      setAuthorized(true);
      setError("");
      return;
    }
    setError("PIN invalido.");
  }

  async function addMenu(e: FormEvent) {
    e.preventDefault();

    const addons = addonsText
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    const res = await fetch("/api/menu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description,
        price: Number(price),
        category,
        imageUrl,
        available: true,
        addons,
      }),
    });

    if (!res.ok) {
      setError("Nao foi possivel cadastrar item.");
      return;
    }

    setName("");
    setDescription("");
    setPrice("");
    setImageUrl("");
    setAddonsText("");
    setError("");
    loadData();
  }

  async function toggleAvailability(item: MenuItem) {
    await fetch(`/api/menu/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...item, available: !item.available }),
    });
    loadData();
  }

  async function deleteItem(id: string) {
    await fetch(`/api/menu/${id}`, { method: "DELETE" });
    loadData();
  }

  async function nextStatus(order: Order) {
    const currentIndex = statusFlow.indexOf(order.status);
    if (currentIndex >= statusFlow.length - 1) return;

    await fetch(`/api/orders/${order.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: statusFlow[currentIndex + 1] }),
    });

    loadData();
  }

  if (!authorized) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center px-4 py-10">
        <form onSubmit={login} className="w-full rounded-3xl border border-cafe/20 bg-paper p-6 shadow-card">
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-tomate">Painel Administrativo</p>
          <h1 className="mt-2 text-5xl leading-none">Login</h1>
          <p className="mt-2 text-sm text-cafe/80">Digite o PIN para gerenciar cardapio e pedidos.</p>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="PIN"
            className="mt-5 w-full rounded-xl border border-cafe/20 bg-white px-3 py-2 outline-none ring-tomate/30 focus:ring"
          />
          <button className="mt-4 w-full rounded-xl bg-cafe px-4 py-3 font-bold text-white">Entrar</button>
          {error && <p className="mt-3 text-sm font-semibold text-tomate">{error}</p>}
          <p className="mt-4 text-xs text-cafe/65">PIN padrao: 1234 (altere em NEXT_PUBLIC_ADMIN_PIN).</p>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 md:px-8 md:py-10">
      <header className="rounded-3xl border border-cafe/15 bg-paper/90 p-6 shadow-card md:flex md:items-end md:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-oliva">Area Administrativa</p>
          <h1 className="mt-2 text-6xl leading-none">Controle da Padaria Solar</h1>
        </div>
        <a href="/" className="mt-4 inline-block text-sm font-bold text-cafe/70 md:mt-0">
          Voltar para cardapio
        </a>
      </header>

      <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <form onSubmit={addMenu} className="h-fit rounded-3xl border border-cafe/15 bg-paper p-5 shadow-card">
          <h2 className="text-3xl">Novo Item</h2>
          <div className="mt-4 space-y-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome"
              required
              className="w-full rounded-xl border border-cafe/20 bg-white px-3 py-2"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descricao"
              required
              className="h-20 w-full resize-none rounded-xl border border-cafe/20 bg-white px-3 py-2"
            />
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              type="number"
              min="0"
              step="0.01"
              placeholder="Preco"
              required
              className="w-full rounded-xl border border-cafe/20 bg-white px-3 py-2"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as MenuCategory)}
              className="w-full rounded-xl border border-cafe/20 bg-white px-3 py-2"
            >
              <option>Salgado</option>
              <option>Lanche</option>
              <option>Bebida</option>
              <option>Doce</option>
            </select>
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="URL da foto"
              required
              className="w-full rounded-xl border border-cafe/20 bg-white px-3 py-2"
            />
            <input
              value={addonsText}
              onChange={(e) => setAddonsText(e.target.value)}
              placeholder="Acompanhamentos (separados por virgula)"
              className="w-full rounded-xl border border-cafe/20 bg-white px-3 py-2"
            />
            <button className="w-full rounded-xl bg-gradient-to-r from-tomate to-mostarda px-4 py-3 font-bold text-white">
              Cadastrar Item
            </button>
          </div>
        </form>

        <div className="space-y-6">
          <section className="rounded-3xl border border-cafe/15 bg-paper p-5 shadow-card">
            <h2 className="text-4xl">Cardapio Atual</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {menu.map((item) => (
                <article key={item.id} className="rounded-2xl border border-cafe/15 bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-2xl leading-none">{item.name}</h3>
                    <span className="text-xs font-bold uppercase tracking-[0.1em] text-oliva">{item.category}</span>
                  </div>
                  <p className="mt-1 text-sm text-cafe/75">{item.description}</p>
                  {item.addons && item.addons.length > 0 && (
                    <p className="mt-2 text-xs text-cafe/70">Acompanhamentos: {item.addons.join(", ")}</p>
                  )}
                  <p className="mt-2 text-sm font-bold">{currency(item.price)}</p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => toggleAvailability(item)}
                      className="flex-1 rounded-lg border border-cafe/20 px-2 py-2 text-xs font-bold"
                    >
                      {item.available ? "Desativar" : "Ativar"}
                    </button>
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="rounded-lg bg-tomate px-3 py-2 text-xs font-bold text-white"
                    >
                      Excluir
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-cafe/15 bg-paper p-5 shadow-card">
            <h2 className="text-4xl">Pedidos</h2>
            <div className="mt-4 grid gap-4 xl:grid-cols-4">
              {groupedOrders.map((group) => (
                <div key={group.status} className="rounded-2xl border border-cafe/15 bg-white p-3">
                  <h3 className="text-2xl">{statusLabel(group.status)}</h3>
                  <div className="mt-3 space-y-2">
                    {group.items.length === 0 && <p className="text-xs text-cafe/60">Sem pedidos.</p>}
                    {group.items.map((order) => (
                      <article key={order.id} className="rounded-xl border border-cafe/10 p-2">
                        <p className="font-bold">{order.customerName}</p>
                        <p className="text-xs text-cafe/65">{new Date(order.createdAt).toLocaleTimeString("pt-BR")}</p>
                        <ul className="mt-2 space-y-1 text-xs">
                          {order.items.map((item) => (
                            <li key={`${order.id}-${item.itemId}`}>
                              {item.quantity}x {item.name}
                            </li>
                          ))}
                        </ul>
                        {order.notes && <p className="mt-2 text-xs italic text-cafe/65">Obs: {order.notes}</p>}
                        <p className="mt-2 text-sm font-bold">{currency(order.total)}</p>
                        <button
                          onClick={() => nextStatus(order)}
                          disabled={order.status === "entregue"}
                          className="mt-2 w-full rounded-lg bg-cafe px-2 py-2 text-xs font-bold text-white disabled:opacity-40"
                        >
                          Avancar status
                        </button>
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
