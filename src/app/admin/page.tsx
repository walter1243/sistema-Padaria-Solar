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

function getOrderTableId(order: Order) {
  if (order.tableId && order.tableId.trim().length > 0) {
    return order.tableId.trim();
  }

  const match = order.customerName.match(/\d+/);
  return match ? match[0] : "sem-mesa";
}

export default function AdminPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
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
  const [baseUrl, setBaseUrl] = useState("");
  const [activeSection, setActiveSection] = useState<"menu" | "tables" | "orders">("menu");
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    async function checkSession() {
      try {
        const res = await fetch("/api/admin/session", { cache: "no-store" });
        setAuthorized(res.ok);
      } finally {
        setCheckingSession(false);
      }
    }

    checkSession();
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setBaseUrl(window.location.origin);
    }
  }, []);

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

  const tableSummaries = useMemo(() => {
    const activeOrders = orders.filter((order) => order.status !== "entregue");
    const map: Record<string, { tableId: string; total: number; count: number; orders: Order[] }> = {};

    activeOrders.forEach((order) => {
      const tableId = getOrderTableId(order);
      if (!map[tableId]) {
        map[tableId] = { tableId, total: 0, count: 0, orders: [] };
      }

      map[tableId].total += order.total;
      map[tableId].count += 1;
      map[tableId].orders.push(order);
    });

    return Object.values(map).sort((a, b) => a.tableId.localeCompare(b.tableId, "pt-BR", { numeric: true }));
  }, [orders]);

  async function login(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (res.ok) {
      setAuthorized(true);
      setError("");
      setPassword("");
      return;
    }

    setError("Usuario ou senha invalidos.");
  }

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    setAuthorized(false);
    setUsername("");
    setPassword("");
  }

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#060b14] text-[#d6e3f8]">
        <p className="text-sm font-semibold uppercase tracking-[0.14em]">Carregando painel...</p>
      </main>
    );
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

  async function closeTableAccount(tableId: string) {
    const activeOrders = orders.filter((order) => getOrderTableId(order) === tableId && order.status !== "entregue");

    await Promise.all(
      activeOrders.map((order) =>
        fetch(`/api/orders/${order.id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "entregue" }),
        }),
      ),
    );

    loadData();
  }

  if (!authorized) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#060b14] px-4 py-10 text-[#eef4ff]">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "url('/images/capa-solar-supermercado.jpg')",
          }}
        />
        <div className="absolute inset-0 bg-[#020917]/58" />

        <form
          onSubmit={login}
          className="relative z-10 w-full max-w-md rounded-3xl border border-white/12 bg-black/68 p-6 shadow-[0_20px_40px_rgba(0,0,0,0.6)] backdrop-blur-[2px]"
        >
          <h1 className="text-center text-5xl font-light leading-none tracking-[0.06em] text-white">Padaria Solar</h1>

          <div className="mt-6 space-y-2">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Usuario"
              className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-white outline-none placeholder:text-white/60 focus:border-[#f7bf3f]"
            />
          </div>

          <div className="relative mt-3">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha"
              className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 pr-10 text-white outline-none placeholder:text-white/60 focus:border-[#f7bf3f]"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70"
              aria-label="Mostrar senha"
            >
              {showPassword ? "◐" : "◉"}
            </button>
          </div>

          <button className="mt-4 w-full rounded-xl bg-[#f7b731] px-4 py-3 font-black text-black hover:brightness-95">
            Entrar
          </button>

          {error && <p className="mt-3 text-sm font-semibold text-[#ff8c98]">{error}</p>}
        </form>
      </main>
    );
  }

  const sidebarItemClass = (id: "menu" | "tables" | "orders") =>
    `w-full rounded-xl px-3 py-2 text-left text-sm font-bold transition ${
      activeSection === id
        ? "bg-gradient-to-r from-[#c81f2f] to-[#0f5bd4] text-white"
        : "bg-[#13233f] text-[#d3e4ff] hover:bg-[#1a2f50]"
    }`;

  return (
    <main className="min-h-screen bg-[#060b14] text-[#eef4ff]">
      <div className="mx-auto max-w-[1600px] px-3 py-4 md:px-6 md:py-6">
        <header className="mb-4 flex items-center justify-between rounded-2xl border border-[#244063] bg-[#0b1424] p-3 md:p-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8db5ff]">Painel Administrador</p>
            <h1 className="text-2xl text-white md:text-4xl">Padaria Solar</h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg border border-[#365682] bg-[#13233f] px-3 py-2 text-xs font-bold text-[#d9e7ff] md:hidden"
            >
              Menu
            </button>
            <a href="/" className="hidden text-sm font-bold text-[#d9e7ff] md:inline-block">
              Cardapio
            </a>
            <a href="/kitchen" className="hidden text-sm font-bold text-[#d9e7ff] md:inline-block">
              Cozinha
            </a>
            <button
              onClick={logout}
              className="rounded-lg border border-[#365682] bg-[#13233f] px-3 py-2 text-xs font-bold text-[#d9e7ff]"
            >
              Sair
            </button>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-[260px_1fr]">
          <aside className="hidden rounded-2xl border border-[#234062] bg-[#0b1424] p-3 md:block">
            <p className="px-2 pb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#8db5ff]">Navegacao</p>
            <div className="space-y-2">
              <button onClick={() => setActiveSection("menu")} className={sidebarItemClass("menu")}>
                Cardapio
              </button>
              <button onClick={() => setActiveSection("tables")} className={sidebarItemClass("tables")}>
                Mesas
              </button>
              <button onClick={() => setActiveSection("orders")} className={sidebarItemClass("orders")}>
                Pedidos
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-[#2a4162] bg-[#101d33] p-3">
              <p className="text-xs text-[#9bb0d0]">Perfis do sistema</p>
              <p className="mt-2 text-sm font-bold text-[#d9e7ff]">1. Cliente</p>
              <p className="text-sm font-bold text-[#d9e7ff]">2. Cozinha</p>
              <p className="text-sm font-bold text-[#d9e7ff]">3. Administrador</p>
            </div>
          </aside>

          <section className="space-y-4">
            {activeSection === "menu" && (
              <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
                <form
                  onSubmit={addMenu}
                  className="h-fit rounded-2xl border border-[#234062] bg-[#0b1424] p-4 shadow-[0_10px_24px_rgba(0,0,0,0.35)]"
                >
                  <h2 className="text-2xl text-white">Novo Item</h2>
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

                <section className="rounded-2xl border border-[#234062] bg-[#0b1424] p-4 shadow-[0_10px_24px_rgba(0,0,0,0.35)]">
                  <h2 className="text-3xl text-white">Cardapio Atual</h2>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {menu.map((item) => (
                      <article key={item.id} className="rounded-2xl border border-[#2a4162] bg-[#101d33] p-3">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-xl leading-none text-white">{item.name}</h3>
                          <span className="text-xs font-bold uppercase tracking-[0.1em] text-[#8db5ff]">
                            {item.category}
                          </span>
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
              </div>
            )}

            {activeSection === "tables" && (
              <section className="rounded-2xl border border-[#234062] bg-[#0b1424] p-4 shadow-[0_10px_24px_rgba(0,0,0,0.35)]">
                <div className="flex items-center justify-between">
                  <h2 className="text-3xl text-white">Mesas</h2>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#8db5ff]">
                    QR e conta em tempo real
                  </p>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 12 }).map((_, index) => {
                    const tableId = String(index + 1);
                    const orderLink = `${baseUrl}/?mesa=${tableId}`;
                    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(orderLink)}`;
                    const summary = tableSummaries.find((table) => table.tableId === tableId);

                    return (
                      <article key={tableId} className="rounded-2xl border border-[#2a4162] bg-[#101d33] p-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xl text-white">Mesa {tableId}</h3>
                          <span className="text-xs font-bold text-[#8db5ff]">{summary?.count || 0} pedidos</span>
                        </div>

                        <img src={qrUrl} alt={`QR Mesa ${tableId}`} className="mx-auto mt-3 h-28 w-28 rounded-lg bg-white p-1" />

                        <p className="mt-3 text-xs text-[#9bb0d0]">Link: {orderLink}</p>
                        <p className="mt-2 text-sm font-bold text-[#ff8c98]">
                          Conta aberta: {currency(summary?.total || 0)}
                        </p>

                        {summary && summary.total > 0 && (
                          <button
                            onClick={() => closeTableAccount(tableId)}
                            className="mt-2 w-full rounded-lg bg-[#c81f2f] px-2 py-2 text-xs font-bold text-white"
                          >
                            Fechar conta da mesa
                          </button>
                        )}

                        {summary && summary.orders.length > 0 && (
                          <ul className="mt-2 space-y-1 text-xs text-[#d6e3f8]">
                            {summary.orders.slice(0, 3).map((order) => (
                              <li key={order.id}>
                                {order.customerName} • {currency(order.total)}
                              </li>
                            ))}
                          </ul>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {activeSection === "orders" && (
              <section className="rounded-2xl border border-[#234062] bg-[#0b1424] p-4 shadow-[0_10px_24px_rgba(0,0,0,0.35)]">
                <h2 className="text-3xl text-white">Pedidos</h2>
                <div className="mt-4 grid gap-4 xl:grid-cols-4">
                  {groupedOrders.map((group) => (
                    <div key={group.status} className="rounded-2xl border border-[#2a4162] bg-[#101d33] p-3">
                      <h3 className="text-2xl text-white">{statusLabel(group.status)}</h3>
                      <div className="mt-3 space-y-2">
                        {group.items.length === 0 && <p className="text-xs text-[#93a8c6]">Sem pedidos.</p>}
                        {group.items.map((order) => (
                          <article key={order.id} className="rounded-xl border border-[#2b4062] p-2">
                            <p className="font-bold text-[#eef4ff]">{order.customerName}</p>
                            <p className="text-xs text-[#93a8c6]">
                              {new Date(order.createdAt).toLocaleTimeString("pt-BR")}
                            </p>
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
            )}
          </section>
        </div>
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 md:hidden" onClick={() => setSidebarOpen(false)}>
          <aside className="h-full w-72 border-r border-[#234062] bg-[#0b1424] p-3" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold text-[#d9e7ff]">Menu</p>
              <button onClick={() => setSidebarOpen(false)} className="text-[#8db5ff]">X</button>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => {
                  setActiveSection("menu");
                  setSidebarOpen(false);
                }}
                className={sidebarItemClass("menu")}
              >
                Cardapio
              </button>
              <button
                onClick={() => {
                  setActiveSection("tables");
                  setSidebarOpen(false);
                }}
                className={sidebarItemClass("tables")}
              >
                Mesas
              </button>
              <button
                onClick={() => {
                  setActiveSection("orders");
                  setSidebarOpen(false);
                }}
                className={sidebarItemClass("orders")}
              >
                Pedidos
              </button>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
