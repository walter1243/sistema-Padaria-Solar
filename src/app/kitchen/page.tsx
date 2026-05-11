"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Order, OrderStatus } from "@/lib/types";

const columns: OrderStatus[] = ["novo", "preparando", "pronto", "entregue"];

function currency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function statusTitle(status: OrderStatus) {
  const map: Record<OrderStatus, string> = {
    novo: "Novo",
    preparando: "Preparando",
    pronto: "Pronto",
    entregue: "Entregue",
  };
  return map[status];
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

  const grouped = useMemo(() => {
    return columns.map((status) => ({
      status,
      orders: orders.filter((order) => order.status === status),
    }));
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

  async function nextStatus(order: Order) {
    const index = columns.indexOf(order.status);
    if (index >= columns.length - 1) return;

    await fetch(`/api/orders/${order.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: columns[index + 1] }),
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
    <main className="min-h-screen bg-[#060b14] px-4 py-8 text-[#eef4ff] md:px-8 md:py-10">
      <header className="rounded-3xl border border-[#244063] bg-[#0b1424] p-6 shadow-[0_12px_30px_rgba(0,0,0,0.45)] md:flex md:items-center md:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#8db5ff]">Painel da Cozinha</p>
          <h1 className="mt-2 text-5xl leading-none text-white">Producao e Status</h1>
        </div>
        <div className="mt-4 flex items-center gap-2 md:mt-0">
          <a href="/" className="text-sm font-bold text-[#d9e7ff]">Cardapio</a>
          <button onClick={logout} className="rounded-lg border border-[#365682] bg-[#13233f] px-3 py-2 text-xs font-bold text-[#d9e7ff]">Sair</button>
        </div>
      </header>

      <section className="mt-6 grid gap-4 xl:grid-cols-4">
        {grouped.map((group) => (
          <div key={group.status} className="rounded-2xl border border-[#2a4162] bg-[#101d33] p-3">
            <h2 className="text-2xl text-white">{statusTitle(group.status)}</h2>
            <div className="mt-3 space-y-3">
              {group.orders.length === 0 && <p className="text-xs text-[#93a8c6]">Sem pedidos.</p>}
              {group.orders.map((order) => (
                <article key={order.id} className="rounded-xl border border-[#2b4062] p-3">
                  <p className="font-bold text-[#eef4ff]">{order.customerName}</p>
                  <p className="text-xs text-[#93a8c6]">Mesa {order.tableId || "-"} • {new Date(order.createdAt).toLocaleTimeString("pt-BR")}</p>
                  <ul className="mt-2 space-y-1 text-xs text-[#d6e3f8]">
                    {order.items.map((item) => (
                      <li key={`${order.id}-${item.itemId}`}>{item.quantity}x {item.name}</li>
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
      </section>
    </main>
  );
}
