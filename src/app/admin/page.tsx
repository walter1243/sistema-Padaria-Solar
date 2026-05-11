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
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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

  const expectedUser = "admin";
  const expectedPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "123456";

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
    const isValid = username.trim().toLowerCase() === expectedUser && password === expectedPassword;
    if (isValid) {
      setAuthorized(true);
      setError("");
      return;
    }
    setError("Usuario ou senha invalidos.");
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
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#060b14] px-4 py-10 text-[#eef4ff]">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-35"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1600&q=80')",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#020918]/90 via-[#0d2e70]/80 to-[#8f1722]/75" />

        <form
          onSubmit={login}
          className="relative z-10 w-full max-w-md rounded-3xl border border-[#284163] bg-[#0b1424]/95 p-6 shadow-[0_18px_40px_rgba(0,0,0,0.55)] backdrop-blur-sm"
        >
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#8db5ff]">Painel Administrativo</p>
          <h1 className="mt-2 text-5xl leading-none text-white">Padaria Solar</h1>
          <p className="mt-2 text-sm text-[#afc3e0]">Acesso de gestao do cardapio e dos pedidos em tempo real.</p>

          <div className="mt-5 space-y-2">
            <label className="text-xs font-bold uppercase tracking-[0.12em] text-[#9bb0d0]">Usuario</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              className="w-full rounded-xl border border-[#2e476f] bg-[#091426] px-3 py-2 text-[#eef4ff] outline-none focus:border-[#0f5bd4]"
            />
          </div>

          <div className="mt-4 space-y-2">
            <label className="text-xs font-bold uppercase tracking-[0.12em] text-[#9bb0d0]">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite a senha"
              className="w-full rounded-xl border border-[#2e476f] bg-[#091426] px-3 py-2 text-[#eef4ff] outline-none focus:border-[#0f5bd4]"
            />
          </div>

          <button className="mt-5 w-full rounded-xl bg-gradient-to-r from-[#c81f2f] to-[#0f5bd4] px-4 py-3 font-bold text-white">
            Entrar
          </button>

          {error && <p className="mt-3 text-sm font-semibold text-[#ff8c98]">{error}</p>}

          <p className="mt-4 text-xs text-[#9bb0d0]">Usuario: admin | Senha via NEXT_PUBLIC_ADMIN_PASSWORD.</p>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#060b14] px-4 py-8 text-[#eef4ff] md:px-8 md:py-10">
      <header
        className="rounded-3xl border border-[#244063] bg-[#0b1424]/95 p-6 shadow-[0_12px_30px_rgba(0,0,0,0.45)] md:flex md:items-end md:justify-between"
        style={{
          backgroundImage:
            "linear-gradient(120deg, rgba(2,9,24,0.92), rgba(13,46,112,0.82), rgba(143,23,34,0.7))",
        }}
      >
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#8db5ff]">Area Administrativa</p>
          <h1 className="mt-2 text-6xl leading-none text-white">Controle da Padaria Solar</h1>
        </div>
        <a href="/" className="mt-4 inline-block text-sm font-bold text-[#d9e7ff] md:mt-0">
          Voltar para cardapio
        </a>
      </header>

      <section className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
        <form
          onSubmit={addMenu}
          className="h-fit rounded-3xl border border-[#234062] bg-[#0b1424] p-5 shadow-[0_10px_24px_rgba(0,0,0,0.35)]"
        >
          <h2 className="text-3xl text-white">Novo Item</h2>
          <div className="mt-4 space-y-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome"
              required
              className="w-full rounded-xl border border-[#2f466d] bg-[#091426] px-3 py-2 text-[#eef4ff]"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descricao"
              required
              className="h-20 w-full resize-none rounded-xl border border-[#2f466d] bg-[#091426] px-3 py-2 text-[#eef4ff]"
            />
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              type="number"
              min="0"
              step="0.01"
              placeholder="Preco"
              required
              className="w-full rounded-xl border border-[#2f466d] bg-[#091426] px-3 py-2 text-[#eef4ff]"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as MenuCategory)}
              className="w-full rounded-xl border border-[#2f466d] bg-[#091426] px-3 py-2 text-[#eef4ff]"
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
              className="w-full rounded-xl border border-[#2f466d] bg-[#091426] px-3 py-2 text-[#eef4ff]"
            />
            <input
              value={addonsText}
              onChange={(e) => setAddonsText(e.target.value)}
              placeholder="Acompanhamentos (separados por virgula)"
              className="w-full rounded-xl border border-[#2f466d] bg-[#091426] px-3 py-2 text-[#eef4ff]"
            />
            <button className="w-full rounded-xl bg-gradient-to-r from-[#c81f2f] to-[#0f5bd4] px-4 py-3 font-bold text-white">
              Cadastrar Item
            </button>
          </div>
        </form>

        <div className="space-y-6">
          <section className="rounded-3xl border border-[#234062] bg-[#0b1424] p-5 shadow-[0_10px_24px_rgba(0,0,0,0.35)]">
            <h2 className="text-4xl text-white">Cardapio Atual</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {menu.map((item) => (
                <article key={item.id} className="rounded-2xl border border-[#2a4162] bg-[#101d33] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-2xl leading-none text-white">{item.name}</h3>
                    <span className="text-xs font-bold uppercase tracking-[0.1em] text-[#8db5ff]">{item.category}</span>
                  </div>
                  <p className="mt-1 text-sm text-[#b2c5e2]">{item.description}</p>
                  {item.addons && item.addons.length > 0 && (
                    <p className="mt-2 text-xs text-[#97afcf]">Acompanhamentos: {item.addons.join(", ")}</p>
                  )}
                  <p className="mt-2 text-sm font-bold text-[#ff8c98]">{currency(item.price)}</p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => toggleAvailability(item)}
                      className="flex-1 rounded-lg border border-[#2e476f] bg-[#13233f] px-2 py-2 text-xs font-bold text-[#d3e4ff]"
                    >
                      {item.available ? "Desativar" : "Ativar"}
                    </button>
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="rounded-lg bg-[#c81f2f] px-3 py-2 text-xs font-bold text-white"
                    >
                      Excluir
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-[#234062] bg-[#0b1424] p-5 shadow-[0_10px_24px_rgba(0,0,0,0.35)]">
            <h2 className="text-4xl text-white">Pedidos</h2>
            <div className="mt-4 grid gap-4 xl:grid-cols-4">
              {groupedOrders.map((group) => (
                <div key={group.status} className="rounded-2xl border border-[#2a4162] bg-[#101d33] p-3">
                  <h3 className="text-2xl text-white">{statusLabel(group.status)}</h3>
                  <div className="mt-3 space-y-2">
                    {group.items.length === 0 && <p className="text-xs text-[#93a8c6]">Sem pedidos.</p>}
                    {group.items.map((order) => (
                      <article key={order.id} className="rounded-xl border border-[#2b4062] p-2">
                        <p className="font-bold text-[#eef4ff]">{order.customerName}</p>
                        <p className="text-xs text-[#93a8c6]">{new Date(order.createdAt).toLocaleTimeString("pt-BR")}</p>
                        <ul className="mt-2 space-y-1 text-xs text-[#d6e3f8]">
                          {order.items.map((item) => (
                            <li key={`${order.id}-${item.itemId}`}>
                              {item.quantity}x {item.name}
                            </li>
                          ))}
                        </ul>
                        {order.notes && <p className="mt-2 text-xs italic text-[#93a8c6]">Obs: {order.notes}</p>}
                        <p className="mt-2 text-sm font-bold text-[#ff8c98]">{currency(order.total)}</p>
                        <button
                          onClick={() => nextStatus(order)}
                          disabled={order.status === "entregue"}
                          className="mt-2 w-full rounded-lg bg-[#0f5bd4] px-2 py-2 text-xs font-bold text-white disabled:opacity-40"
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
