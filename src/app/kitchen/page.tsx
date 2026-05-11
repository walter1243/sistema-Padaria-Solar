"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Order, OrderStatus } from "@/lib/types";

const columns: OrderStatus[] = ["novo", "preparando", "pronto"];

function statusTitle(status: OrderStatus) {
  const map: Record<OrderStatus, string> = {
    novo: "Recebido",
    preparando: "Preparando",
    pronto: "Pronto",
    entregue: "Entregue",
  };
  return map[status];
}

function statusBadge(status: OrderStatus) {
  if (status === "novo") return "bg-[#c81f2f]/20 text-[#ff9eaa]";
  if (status === "preparando") return "bg-[#0f5bd4]/20 text-[#9bc5ff]";
  if (status === "pronto") return "bg-[#1f8b4c]/20 text-[#8fe0b8]";
  return "bg-[#2f466d] text-[#d6e3f8]";
}

export default function KitchenPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);

  async function loadOrders() {
    const res = await fetch("/api/orders", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as Order[];
    setOrders(data);
  }

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch("/api/kitchen/session", { cache: "no-store" });
        setAuthorized(res.ok);
      } finally {
        setCheckingSession(false);
      }
    }

    checkSession();
  }, []);

  useEffect(() => {
    if (!authorized) return;
    loadOrders();
    const timer = setInterval(loadOrders, 4000);
    return () => clearInterval(timer);
  }, [authorized]);

  const tableGroups = useMemo(() => {
    const activeOrders = orders.filter((order) => columns.includes(order.status));
    const map: Record<string, Order[]> = {};

    activeOrders.forEach((order) => {
      const tableId = order.tableId?.trim() || "sem-mesa";
      if (!map[tableId]) {
        map[tableId] = [];
      }
      map[tableId].push(order);
    });

    return Object.entries(map)
      .map(([tableId, tableOrders]) => ({
        tableId,
        orders: tableOrders.sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1)),
      }))
      .sort((a, b) => a.tableId.localeCompare(b.tableId, "pt-BR", { numeric: true }));
  }, [orders]);

  async function login(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/kitchen/login", {
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
    await fetch("/api/kitchen/login", { method: "DELETE" });
    setAuthorized(false);
    setUsername("");
    setPassword("");
  }

  async function setStatus(order: Order, nextStatus: Exclude<OrderStatus, "entregue">) {
    await fetch(`/api/orders/${order.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });

    loadOrders();
  }

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#060b14] text-[#d6e3f8]">
        <p className="text-sm font-semibold uppercase tracking-[0.14em]">Carregando cozinha...</p>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#060b14] px-4 py-10 text-[#eef4ff]">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/images/capa-solar-supermercado.jpg')" }}
        />
        <div className="absolute inset-0 bg-[#020917]/58" />

        <form
          onSubmit={login}
          className="relative z-10 w-full max-w-md rounded-3xl border border-white/12 bg-black/68 p-6 shadow-[0_20px_40px_rgba(0,0,0,0.6)]"
        >
          <h1 className="text-center text-5xl font-light leading-none tracking-[0.06em] text-white">Cozinha Solar</h1>

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
            >
              {showPassword ? "◐" : "◉"}
            </button>
          </div>

          <button className="mt-4 w-full rounded-xl bg-[#f7b731] px-4 py-3 font-black text-black">Entrar</button>

          {error && <p className="mt-3 text-sm font-semibold text-[#ff8c98]">{error}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#060b14] px-4 py-6 text-[#eef4ff] md:px-8 md:py-8">
      <header className="rounded-3xl border border-[#244063] bg-[#0b1424] p-5 shadow-[0_12px_30px_rgba(0,0,0,0.45)] md:flex md:items-center md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8db5ff]">Kitchen Display System</p>
          <h1 className="mt-2 text-4xl font-black leading-none text-white md:text-5xl">Painel do Padeiro</h1>
          <p className="mt-2 text-sm text-[#9bb0d0]">Divisao por mesa: cada mesa mostra pedidos e status para avancar.</p>
        </div>
        <div className="mt-4 flex items-center gap-2 md:mt-0">
          <button
            onClick={logout}
            className="rounded-lg border border-[#365682] bg-[#13233f] px-3 py-2 text-xs font-bold text-[#d9e7ff]"
          >
            Sair
          </button>
        </div>
      </header>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tableGroups.length === 0 && (
          <article className="rounded-2xl border border-[#2a4162] bg-[#101d33] p-4 text-sm text-[#93a8c6]">
            Nenhum pedido ativo no momento.
          </article>
        )}

        {tableGroups.map((group) => (
          <article key={group.tableId} className="rounded-2xl border border-[#2a4162] bg-[#101d33] p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-black text-white">Mesa {group.tableId}</h2>
              <span className="rounded-full bg-[#244063] px-3 py-1 text-xs font-bold text-[#d6e3f8]">
                {group.orders.length} pedido(s)
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {group.orders.map((order) => (
                <div key={order.id} className="rounded-xl border border-[#2b4062] bg-[#0b1424] p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-[#93a8c6]">{new Date(order.createdAt).toLocaleTimeString("pt-BR")}</p>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusBadge(order.status)}`}>
                      {statusTitle(order.status)}
                    </span>
                  </div>

                  <ul className="mt-2 space-y-1 text-sm text-[#d6e3f8]">
                    {order.items.map((item) => (
                      <li key={`${order.id}-${item.itemId}`}>
                        {item.quantity}x {item.name}
                      </li>
                    ))}
                  </ul>

                  {order.notes && (
                    <p className="mt-2 rounded-lg border border-[#2e476f] bg-[#13233f] px-2 py-2 text-xs italic text-[#b7cbe8]">
                      Obs: {order.notes}
                    </p>
                  )}

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setStatus(order, "novo")}
                      className={`rounded-lg px-2 py-2 text-xs font-black ${
                        order.status === "novo"
                          ? "bg-[#c81f2f] text-white"
                          : "border border-[#2f466d] bg-[#13233f] text-[#d9e7ff]"
                      }`}
                    >
                      Recebido
                    </button>
                    <button
                      onClick={() => setStatus(order, "preparando")}
                      className={`rounded-lg px-2 py-2 text-xs font-black ${
                        order.status === "preparando"
                          ? "bg-[#0f5bd4] text-white"
                          : "border border-[#2f466d] bg-[#13233f] text-[#d9e7ff]"
                      }`}
                    >
                      Preparando
                    </button>
                    <button
                      onClick={() => setStatus(order, "pronto")}
                      className={`rounded-lg px-2 py-2 text-xs font-black ${
                        order.status === "pronto"
                          ? "bg-[#1f8b4c] text-white"
                          : "border border-[#2f466d] bg-[#13233f] text-[#d9e7ff]"
                      }`}
                    >
                      Pronto
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
