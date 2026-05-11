"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { MenuCategory, MenuItem, Order, OrderStatus, PaymentMethod, PaymentRecord, UnitMeasure } from "@/lib/types";

const statusFlow: OrderStatus[] = ["novo", "preparando", "pronto", "entregue"];

type AdminSection = "dashboard" | "menu" | "tables" | "orders" | "reports";

type ReportsSummary = {
  totalPaid: number;
  totalsByMethod: {
    dinheiro: number;
    pix: number;
    cartao: number;
  };
  payments: PaymentRecord[];
};

type ProductDraft = {
  name: string;
  description: string;
  price: string;
  category: MenuCategory;
  unit: UnitMeasure;
  imageUrl: string;
  addonsText: string;
};

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
  const [unit, setUnit] = useState<UnitMeasure>("un");
  const [imageUrl, setImageUrl] = useState("");
  const [addonsText, setAddonsText] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [activeSection, setActiveSection] = useState<AdminSection>("dashboard");
  const [formNotice, setFormNotice] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [kitchenUser, setKitchenUser] = useState("");
  const [kitchenPass, setKitchenPass] = useState("");
  const [reports, setReports] = useState<ReportsSummary | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [showKitchenAuthEditor, setShowKitchenAuthEditor] = useState(false);

  // Estados para edição e pesquisa
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchCategory, setSearchCategory] = useState<MenuCategory | "">("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [closeTableId, setCloseTableId] = useState<string | null>(null);
  const [closePaymentMethod, setClosePaymentMethod] = useState<PaymentMethod>("dinheiro");

  async function loadData() {
    const [menuRes, ordersRes, categoriesRes, bakerRes, reportsRes] = await Promise.all([
      fetch("/api/menu", { cache: "no-store" }),
      fetch("/api/orders", { cache: "no-store" }),
      fetch("/api/categories", { cache: "no-store" }),
      fetch("/api/baker/credentials", { cache: "no-store" }),
      fetch("/api/reports/summary", { cache: "no-store" }),
    ]);

    const menuData = (await menuRes.json()) as MenuItem[];
    const orderData = (await ordersRes.json()) as Order[];
    setMenu(menuData);
    setOrders(orderData);

    if (categoriesRes.ok) {
      const categoriesData = (await categoriesRes.json()) as string[];
      setCategories(categoriesData);
    }

    if (bakerRes.ok) {
      const bakerData = (await bakerRes.json()) as { username: string };
      setKitchenUser(bakerData.username || "");
    }

    if (reportsRes.ok) {
      const reportData = (await reportsRes.json()) as ReportsSummary;
      setReports(reportData);
    }
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
    if (authorized) {
      loadData();
    }
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

  const dashboardMetrics = useMemo(() => {
    const deliveredOrders = orders.filter((order) => order.status === "entregue");
    const soldItems = deliveredOrders.reduce(
      (acc, order) => acc + order.items.reduce((sum, item) => sum + item.quantity, 0),
      0,
    );

    return {
      totalProducts: menu.length,
      soldItems,
      totalRevenue: reports?.totalPaid || 0,
      activeTables: tableSummaries.length,
      openOrders: orders.filter((order) => order.status !== "entregue").length,
      closedTables: reports?.payments.length || 0,
    };
  }, [menu.length, orders, reports, tableSummaries.length]);

  const selectedTableSummary = useMemo(() => {
    if (!selectedTableId) return null;
    return tableSummaries.find((table) => table.tableId === selectedTableId) || null;
  }, [selectedTableId, tableSummaries]);

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

  function buildDraftFromForm(): ProductDraft {
    return {
      name,
      description,
      price,
      category,
      unit,
      imageUrl,
      addonsText,
    };
  }

  function applyDraftToForm(draft: ProductDraft) {
    setName(draft.name || "");
    setDescription(draft.description || "");
    setPrice(draft.price || "");
    setCategory(draft.category || "Salgado");
    setUnit(draft.unit || "un");
    setImageUrl(draft.imageUrl || "");
    setAddonsText(draft.addonsText || "");
  }

  function buildDraftFromItem(item: MenuItem): ProductDraft {
    return {
      name: item.name,
      description: item.description,
      price: String(item.price),
      category: item.category,
      unit: item.unit,
      imageUrl: item.imageUrl,
      addonsText: (item.addons || []).join(", "),
    };
  }

  async function copyProductDraft(draft: ProductDraft) {
    try {
      await navigator.clipboard.writeText(JSON.stringify(draft));
      setFormNotice("Produto copiado. Use Colar para preencher o formulario.");
      setError("");
    } catch {
      setError("Nao foi possivel copiar. Verifique permissoes do navegador.");
    }
  }

  async function pasteProductDraft() {
    try {
      const raw = await navigator.clipboard.readText();
      const parsed = JSON.parse(raw) as Partial<ProductDraft>;

      const normalizedCategory: MenuCategory =
        parsed.category === "Salgado" ||
        parsed.category === "Lanche" ||
        parsed.category === "Bebida" ||
        parsed.category === "Doce"
          ? parsed.category
          : "Salgado";

      const normalizedUnit: UnitMeasure =
        parsed.unit === "un" || parsed.unit === "kg" || parsed.unit === "g" || parsed.unit === "l" || parsed.unit === "ml"
          ? parsed.unit
          : "un";

      applyDraftToForm({
        name: typeof parsed.name === "string" ? parsed.name : "",
        description: typeof parsed.description === "string" ? parsed.description : "",
        price: typeof parsed.price === "string" ? parsed.price : "",
        category: normalizedCategory,
        unit: normalizedUnit,
        imageUrl: typeof parsed.imageUrl === "string" ? parsed.imageUrl : "",
        addonsText: typeof parsed.addonsText === "string" ? parsed.addonsText : "",
      });

      setFormNotice("Produto colado no formulario.");
      setError("");
    } catch {
      setError("Nao foi possivel colar. Copie um JSON de produto valido.");
    }
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
        unit,
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
    setUnit("un");
    setImageUrl("");
    setAddonsText("");
    setError("");
    setFormNotice("Item cadastrado com sucesso.");
    loadData();
  }

  async function saveBakerCredentials() {
    const username = kitchenUser.trim();
    const password = kitchenPass.trim();

    if (!username || !password) {
      setError("Informe usuario e senha do padeiro para salvar.");
      return;
    }

    const res = await fetch("/api/baker/credentials", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      setError("Nao foi possivel salvar login do padeiro.");
      return;
    }

    setKitchenPass("");
    setError("");
    setFormNotice("Login do padeiro atualizado com sucesso.");
  }

  async function toggleAvailability(item: MenuItem) {
    await fetch(`/api/menu/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...item, available: !item.available }),
    });
    loadData();
  }

  function editItem(item: MenuItem) {
    applyDraftToForm(buildDraftFromItem(item));
    setEditingItemId(item.id);
    setFormNotice(`Editando: ${item.name}`);
  }

  async function updateItem() {
    if (!editingItemId) return;

    const addons = addonsText
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    const res = await fetch(`/api/menu/${editingItemId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description,
        price: Number(price),
        category,
        unit,
        imageUrl,
        available: true,
        addons,
      }),
    });

    if (!res.ok) {
      setError("Nao foi possivel atualizar item.");
      return;
    }

    setName("");
    setDescription("");
    setPrice("");
    setUnit("un");
    setImageUrl("");
    setAddonsText("");
    setEditingItemId(null);
    setError("");
    setFormNotice("Item atualizado com sucesso.");
    loadData();
  }

  async function confirmDelete(id: string) {
    if (deletePassword !== "123") {
      setError("Senha incorreta. Use '123' para confirmar exclusao.");
      return;
    }

    await fetch(`/api/menu/${id}`, { method: "DELETE" });
    setDeleteModalOpen(false);
    setDeleteItemId(null);
    setDeletePassword("");
    setError("");
    setFormNotice("Produto excluido com sucesso.");
    loadData();
  }

  const filteredMenu = useMemo(() => {
    return menu.filter((item) => {
      const matchesSearch = searchQuery === "" || item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = searchCategory === "" || item.category === searchCategory;
      return matchesSearch && matchesCategory;
    });
  }, [menu, searchQuery, searchCategory]);

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

  async function closeTableAccount() {
    if (!closeTableId) return;

    const res = await fetch("/api/tables/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableId: closeTableId, method: closePaymentMethod }),
    });

    if (!res.ok) {
      setError("Nao foi possivel fechar a mesa. Verifique se ha pedidos ativos.");
      return;
    }

    setCloseTableId(null);
    setClosePaymentMethod("dinheiro");
    setError("");
    setFormNotice("Mesa fechada com pagamento registrado com sucesso.");
    loadData();
  }

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#060b14] text-[#d6e3f8]">
        <p className="text-sm font-semibold uppercase tracking-[0.14em]">Carregando painel...</p>
      </main>
    );
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
              {showPassword ? "Ocultar" : "Mostrar"}
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

  return (
    <main className="min-h-screen flex bg-[#060b14] text-[#eef4ff]">
      {/* Sidebar */}
      <aside className="w-64 border-r border-[#244063] bg-[#0b1424] flex flex-col">
        {/* Logo */}
        <div className="border-b border-[#244063] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8db5ff]">Painel Admin</p>
          <h1 className="text-xl font-bold text-white mt-2">Padaria Solar</h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setActiveSection("dashboard")}
            className={`w-full text-left px-4 py-3 rounded-lg text-sm font-bold transition ${
              activeSection === "dashboard"
                ? "bg-gradient-to-r from-[#c81f2f] to-[#0f5bd4] text-white"
                : "text-[#d3e4ff] hover:bg-[#13233f]"
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveSection("menu")}
            className={`w-full text-left px-4 py-3 rounded-lg text-sm font-bold transition ${
              activeSection === "menu"
                ? "bg-gradient-to-r from-[#c81f2f] to-[#0f5bd4] text-white"
                : "text-[#d3e4ff] hover:bg-[#13233f]"
            }`}
          >
            📦 Cadastro de Produtos
          </button>
          <button
            onClick={() => setActiveSection("tables")}
            className={`w-full text-left px-4 py-3 rounded-lg text-sm font-bold transition ${
              activeSection === "tables"
                ? "bg-gradient-to-r from-[#c81f2f] to-[#0f5bd4] text-white"
                : "text-[#d3e4ff] hover:bg-[#13233f]"
            }`}
          >
            🪑 Mesas
          </button>
          <button
            onClick={() => setActiveSection("orders")}
            className={`w-full text-left px-4 py-3 rounded-lg text-sm font-bold transition ${
              activeSection === "orders"
                ? "bg-gradient-to-r from-[#c81f2f] to-[#0f5bd4] text-white"
                : "text-[#d3e4ff] hover:bg-[#13233f]"
            }`}
          >
            📋 Pedidos
          </button>
          <button
            onClick={() => setActiveSection("reports")}
            className={`w-full text-left px-4 py-3 rounded-lg text-sm font-bold transition ${
              activeSection === "reports"
                ? "bg-gradient-to-r from-[#c81f2f] to-[#0f5bd4] text-white"
                : "text-[#d3e4ff] hover:bg-[#13233f]"
            }`}
          >
            📈 Relatorio
          </button>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowKitchenAuthEditor((value) => !value)}
              className="w-full rounded-lg border border-[#2e476f] bg-[#13233f] px-3 py-2 text-left text-xs font-bold uppercase tracking-[0.08em] text-[#9ec2ff]"
            >
              Login Cozinha {showKitchenAuthEditor ? "▲" : "▼"}
            </button>

            {showKitchenAuthEditor && (
              <div className="mt-2 space-y-2 rounded-xl border border-[#2b4062] bg-[#101d33] p-3">
                <input
                  value={kitchenUser}
                  onChange={(e) => setKitchenUser(e.target.value)}
                  placeholder="Usuario do padeiro"
                  className="w-full rounded-lg border border-[#2f466d] bg-[#091426] px-3 py-2 text-xs text-[#eef4ff]"
                />
                <input
                  type="password"
                  value={kitchenPass}
                  onChange={(e) => setKitchenPass(e.target.value)}
                  placeholder="Nova senha"
                  className="w-full rounded-lg border border-[#2f466d] bg-[#091426] px-3 py-2 text-xs text-[#eef4ff]"
                />
                <button
                  type="button"
                  onClick={saveBakerCredentials}
                  className="w-full rounded-lg border border-[#2f466d] bg-[#13233f] px-3 py-2 text-xs font-bold text-[#d6e3f8]"
                >
                  Salvar Login
                </button>
              </div>
            )}
          </div>
        </nav>

        {/* Links Externos */}
        <div className="border-t border-[#244063] p-4 space-y-2">
          <a
            href="/"
            className="block w-full text-center px-4 py-2 rounded-lg border border-[#365682] bg-[#13233f] text-xs font-bold text-[#d9e7ff] hover:bg-[#1a2f50] transition"
            title="Cardápio do cliente"
          >
            🍽️ Cardápio
          </a>
          <a
            href="/kitchen"
            className="block w-full text-center px-4 py-2 rounded-lg border border-[#c81f2f] bg-[#c81f2f]/10 text-xs font-bold text-[#ff8c98] hover:bg-[#c81f2f]/20 transition"
            title="Painel separado da cozinha"
          >
            👨‍🍳 Padaria
          </a>
          <button
            onClick={logout}
            className="w-full px-4 py-2 rounded-lg border border-[#365682] bg-[#13233f] text-xs font-bold text-[#d9e7ff] hover:bg-[#1a2f50] transition"
          >
            🚪 Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="min-h-screen p-6">
          {/* Header */}
          <header className="mb-6">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8db5ff]">Painel Administrativo</p>
            <h1 className="text-4xl font-bold text-white mt-2">
              {activeSection === "dashboard" && "Dashboard"}
              {activeSection === "menu" && "Cadastro de Produtos"}
              {activeSection === "tables" && "Mesas"}
              {activeSection === "orders" && "Pedidos"}
              {activeSection === "reports" && "Relatorio da Padaria"}
            </h1>
          </header>

          <section className="space-y-4">
            {activeSection === "dashboard" && (
              <section className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  <article className="rounded-2xl border border-[#234062] bg-[#0b1424] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#8db5ff]">Produtos cadastrados</p>
                    <p className="mt-2 text-3xl font-black text-white">{dashboardMetrics.totalProducts}</p>
                  </article>
                  <article className="rounded-2xl border border-[#234062] bg-[#0b1424] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#8db5ff]">Produtos vendidos</p>
                    <p className="mt-2 text-3xl font-black text-white">{dashboardMetrics.soldItems}</p>
                  </article>
                  <article className="rounded-2xl border border-[#234062] bg-[#0b1424] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#8db5ff]">Lucro realizado</p>
                    <p className="mt-2 text-3xl font-black text-[#ff8c98]">{currency(dashboardMetrics.totalRevenue)}</p>
                  </article>
                  <article className="rounded-2xl border border-[#234062] bg-[#0b1424] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#8db5ff]">Mesas ocupadas</p>
                    <p className="mt-2 text-3xl font-black text-white">{dashboardMetrics.activeTables}</p>
                  </article>
                  <article className="rounded-2xl border border-[#234062] bg-[#0b1424] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#8db5ff]">Pedidos abertos</p>
                    <p className="mt-2 text-3xl font-black text-white">{dashboardMetrics.openOrders}</p>
                  </article>
                </div>

                <div className="rounded-2xl border border-[#234062] bg-[#0b1424] p-4">
                  <h2 className="text-2xl text-white">Acesso separado da cozinha</h2>
                  <p className="mt-2 text-sm text-[#c2d4ef]">
                    O padeiro usa o link externo /kitchen com login proprio. Esse perfil nao acessa o painel administrativo.
                  </p>
                </div>
              </section>
            )}

            {activeSection === "menu" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-2xl border border-[#234062] bg-[#0b1424] p-3">
                  <p className="text-sm font-bold text-[#d9e7ff]">Cadastro minimalista</p>
                  <button
                    type="button"
                    onClick={() => setShowProductForm((value) => !value)}
                    className="rounded-lg border border-[#2f466d] bg-[#13233f] px-3 py-2 text-xs font-bold text-[#d6e3f8]"
                  >
                    {showProductForm ? "Fechar cadastro" : "Abrir cadastro"}
                  </button>
                </div>

                <div className={`grid gap-4 ${showProductForm ? "xl:grid-cols-[360px_1fr]" : "xl:grid-cols-1"}`}>
                  {showProductForm && (
                    <form
                      onSubmit={addMenu}
                      className="h-fit rounded-2xl border border-[#234062] bg-[#0b1424] p-4 shadow-[0_10px_24px_rgba(0,0,0,0.35)]"
                    >
                      <h2 className="text-2xl text-white">Novo Item</h2>
                      <p className="mt-1 text-xs text-[#9bb0d0]">Abra somente quando precisar, para manter a tela limpa.</p>
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
                      {categories.length > 0 ? (
                        categories.map((cat) => <option key={cat}>{cat}</option>)
                      ) : (
                        <>
                          <option>Salgado</option>
                          <option>Lanche</option>
                          <option>Bebida</option>
                          <option>Doce</option>
                        </>
                      )}
                    </select>
                    <select
                      value={unit}
                      onChange={(e) => setUnit(e.target.value as UnitMeasure)}
                      className="w-full rounded-xl border border-[#2f466d] bg-[#091426] px-3 py-2 text-[#eef4ff]"
                    >
                      <option value="un">Unidade (un)</option>
                      <option value="kg">Quilo (kg)</option>
                      <option value="g">Grama (g)</option>
                      <option value="l">Litro (l)</option>
                      <option value="ml">Mililitro (ml)</option>
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

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => copyProductDraft(buildDraftFromForm())}
                        className="rounded-xl border border-[#2f466d] bg-[#13233f] px-4 py-2 text-sm font-bold text-[#d6e3f8]"
                      >
                        Copiar Produto
                      </button>
                      <button
                        type="button"
                        onClick={pasteProductDraft}
                        className="rounded-xl border border-[#2f466d] bg-[#13233f] px-4 py-2 text-sm font-bold text-[#d6e3f8]"
                      >
                        Colar Produto
                      </button>
                    </div>

                    {editingItemId ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={updateItem}
                          className="flex-1 rounded-xl bg-gradient-to-r from-[#0f5bd4] to-[#0f5bd4] px-4 py-3 font-bold text-white"
                        >
                          ✏️ Atualizar Item
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingItemId(null);
                            setName("");
                            setDescription("");
                            setPrice("");
                            setUnit("un");
                            setImageUrl("");
                            setAddonsText("");
                            setFormNotice("");
                          }}
                          className="flex-1 rounded-xl border border-[#2f466d] bg-[#13233f] px-4 py-3 font-bold text-[#d6e3f8]"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="submit"
                        className="w-full rounded-xl bg-gradient-to-r from-[#c81f2f] to-[#0f5bd4] px-4 py-3 font-bold text-white"
                      >
                        Cadastrar Item
                      </button>
                    )}
                    {formNotice && <p className="text-xs font-semibold text-[#8fe0b8]">{formNotice}</p>}
                  </div>
                    </form>
                  )}

                <section className="rounded-2xl border border-[#234062] bg-[#0b1424] p-4 shadow-[0_10px_24px_rgba(0,0,0,0.35)]">
                  <h2 className="text-3xl text-white mb-4">Cardápio Atual</h2>

                  {/* Barra de Pesquisa */}
                  <div className="mb-4 space-y-2">
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="🔍 Pesquisar produto por nome ou descrição..."
                      className="w-full rounded-xl border border-[#2f466d] bg-[#091426] px-4 py-3 text-[#eef4ff] placeholder:text-[#7a94b8]"
                    />
                    <div className="flex gap-2">
                      <select
                        value={searchCategory}
                        onChange={(e) => setSearchCategory((e.target.value as MenuCategory) || "")}
                        className="flex-1 rounded-xl border border-[#2f466d] bg-[#091426] px-4 py-2 text-[#eef4ff]"
                      >
                        <option value="">Todas as categorias</option>
                        {categories.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                      {(searchQuery || searchCategory) && (
                        <button
                          onClick={() => {
                            setSearchQuery("");
                            setSearchCategory("");
                          }}
                          className="rounded-xl border border-[#2f466d] bg-[#13233f] px-4 py-2 text-sm font-bold text-[#d6e3f8]"
                        >
                          Limpar
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="mb-3 text-xs text-[#8db5ff]">{filteredMenu.length} produto(s) encontrado(s)</p>

                  <div className="grid gap-3 md:grid-cols-2">
                    {filteredMenu.map((item) => (
                      <article key={item.id} className="rounded-2xl border border-[#2a4162] bg-[#101d33] p-3">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-xl leading-none text-white">{item.name}</h3>
                          <span className={`text-xs font-bold uppercase tracking-[0.1em] px-2 py-1 rounded ${item.available ? "bg-[#8fe0b8]/20 text-[#8fe0b8]" : "bg-[#ff8c98]/20 text-[#ff8c98]"}`}>
                            {item.available ? "Ativo" : "Inativo"}
                          </span>
                        </div>
                        <span className="inline-block mt-2 text-xs font-bold uppercase tracking-[0.1em] text-[#8db5ff]">
                          {item.category}
                        </span>
                        <p className="mt-2 text-sm text-[#b2c5e2]">{item.description}</p>
                        {item.addons && item.addons.length > 0 && (
                          <p className="mt-2 text-xs text-[#97afcf]">Acompanhamentos: {item.addons.join(", ")}</p>
                        )}
                        <p className="mt-2 text-sm font-bold text-[#ff8c98]">{currency(item.price)}</p>
                        <p className="mt-1 text-xs text-[#8db5ff]">Unidade: {item.unit}</p>
                        <div className="mt-3 flex gap-2 flex-wrap">
                          <button
                            onClick={() => editItem(item)}
                            className="rounded-lg border border-[#0f5bd4] bg-[#0f5bd4]/20 px-3 py-2 text-xs font-bold text-[#0f9fff] hover:bg-[#0f5bd4]/40 transition"
                          >
                            ✏️ Editar
                          </button>
                          <button
                            onClick={() => toggleAvailability(item)}
                            className="flex-1 rounded-lg border border-[#2e476f] bg-[#13233f] px-2 py-2 text-xs font-bold text-[#d3e4ff] hover:bg-[#1a2f50] transition"
                          >
                            {item.available ? "🔒 Desativar" : "🔓 Ativar"}
                          </button>
                          <button
                            onClick={() => {
                              setDeleteItemId(item.id);
                              setDeleteModalOpen(true);
                              setDeletePassword("");
                            }}
                            className="rounded-lg bg-[#c81f2f] px-3 py-2 text-xs font-bold text-white hover:bg-[#b01625] transition"
                          >
                            🗑️ Excluir
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
                </div>
              </div>
            )}

            {activeSection === "tables" && (
              <section className="rounded-2xl border border-[#234062] bg-[#0b1424] p-4 shadow-[0_10px_24px_rgba(0,0,0,0.35)]">
                <div className="flex items-center justify-between">
                  <h2 className="text-3xl text-white">Mesas</h2>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#8db5ff]">
                    Acompanhamento em tempo real
                  </p>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 10 }).map((_, index) => {
                    const tableId = String(index + 1);
                    const orderLink = `${baseUrl}/?mesa=${tableId}`;
                    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(orderLink)}`;
                    const summary = tableSummaries.find((table) => table.tableId === tableId);
                    const isOccupied = Boolean(summary && summary.total > 0);

                    return (
                      <article key={tableId} className="rounded-2xl border border-[#2a4162] bg-[#101d33] p-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xl text-white">Mesa {tableId}</h3>
                          <span className={`text-xs font-bold ${isOccupied ? "text-[#ff8c98]" : "text-[#8fe0b8]"}`}>
                            {isOccupied ? "Ocupada" : "Livre"}
                          </span>
                        </div>

                        <img src={qrUrl} alt={`QR Mesa ${tableId}`} className="mx-auto mt-3 h-28 w-28 rounded-lg bg-white p-1" />

                        <p className="mt-3 text-xs text-[#9bb0d0]">Link: {orderLink}</p>
                        <p className="mt-2 text-xs text-[#9bb0d0]">Pedidos ativos: {summary?.count || 0}</p>
                        <p className="mt-2 text-lg font-black text-[#ff8c98]">
                          Total: {currency(summary?.total || 0)}
                        </p>

                        <button
                          onClick={() => setSelectedTableId(tableId)}
                          className="mt-2 w-full rounded-lg border border-[#2e476f] bg-[#13233f] px-2 py-2 text-xs font-bold text-[#d3e4ff]"
                        >
                          Ver detalhes
                        </button>

                        {summary && summary.total > 0 && (
                          <button
                            onClick={() => {
                              setCloseTableId(tableId);
                              setClosePaymentMethod("dinheiro");
                            }}
                            className="mt-2 w-full rounded-lg bg-[#c81f2f] px-2 py-2 text-xs font-bold text-white"
                          >
                            Fechar conta da mesa
                          </button>
                        )}

                        {summary && summary.orders.length > 0 && (
                          <ul className="mt-2 space-y-1 text-xs text-[#d6e3f8]">
                            {summary.orders.slice(0, 3).map((order) => (
                              <li key={order.id}>
                                {order.customerName} - {currency(order.total)}
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
            )}

            {activeSection === "reports" && (
              <section className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <article className="rounded-2xl border border-[#234062] bg-[#0b1424] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#8db5ff]">Total pago</p>
                    <p className="mt-2 text-3xl font-black text-[#ff8c98]">{currency(reports?.totalPaid || 0)}</p>
                  </article>
                  <article className="rounded-2xl border border-[#234062] bg-[#0b1424] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#8db5ff]">Dinheiro</p>
                    <p className="mt-2 text-2xl font-black text-white">{currency(reports?.totalsByMethod.dinheiro || 0)}</p>
                  </article>
                  <article className="rounded-2xl border border-[#234062] bg-[#0b1424] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#8db5ff]">Pix</p>
                    <p className="mt-2 text-2xl font-black text-white">{currency(reports?.totalsByMethod.pix || 0)}</p>
                  </article>
                  <article className="rounded-2xl border border-[#234062] bg-[#0b1424] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#8db5ff]">Cartao</p>
                    <p className="mt-2 text-2xl font-black text-white">{currency(reports?.totalsByMethod.cartao || 0)}</p>
                  </article>
                </div>

                <div className="rounded-2xl border border-[#234062] bg-[#0b1424] p-4">
                  <h2 className="text-2xl text-white">Fechamentos recentes</h2>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[640px] border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-[#2b4062] text-left text-[#8db5ff]">
                          <th className="px-2 py-2">Mesa</th>
                          <th className="px-2 py-2">Metodo</th>
                          <th className="px-2 py-2">Valor</th>
                          <th className="px-2 py-2">Data</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(reports?.payments || []).map((payment) => (
                          <tr key={payment.id} className="border-b border-[#1c2f4a] text-[#d6e3f8]">
                            <td className="px-2 py-2">{payment.tableId}</td>
                            <td className="px-2 py-2 capitalize">{payment.method}</td>
                            <td className="px-2 py-2 font-bold text-[#ff8c98]">{currency(payment.amount)}</td>
                            <td className="px-2 py-2">{new Date(payment.closedAt).toLocaleString("pt-BR")}</td>
                          </tr>
                        ))}
                        {(reports?.payments || []).length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-2 py-4 text-[#93a8c6]">
                              Nenhum fechamento registrado ainda.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}
          </section>
        </div>
      </div>

      {closeTableId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[#365682] bg-[#0b1424] p-6 mx-4">
            <h3 className="text-2xl font-bold text-white">Fechar mesa {closeTableId}</h3>
            <p className="mt-2 text-sm text-[#b2c5e2]">Selecione a forma de pagamento para registrar no relatorio.</p>

            <select
              value={closePaymentMethod}
              onChange={(e) => setClosePaymentMethod(e.target.value as PaymentMethod)}
              className="mt-4 w-full rounded-xl border border-[#2f466d] bg-[#091426] px-3 py-2 text-[#eef4ff]"
            >
              <option value="dinheiro">Dinheiro</option>
              <option value="pix">Pix</option>
              <option value="cartao">Cartao</option>
            </select>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setCloseTableId(null)}
                className="flex-1 rounded-lg border border-[#365682] bg-[#13233f] px-4 py-3 font-bold text-[#d9e7ff]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={closeTableAccount}
                className="flex-1 rounded-lg bg-[#c81f2f] px-4 py-3 font-bold text-white"
              >
                Confirmar fechamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="rounded-2xl border border-[#c81f2f] bg-[#0b1424] p-6 max-w-sm w-full mx-4">
            <h3 className="text-2xl font-bold text-white mb-2">🗑️ Confirmar Exclusão</h3>
            <p className="text-sm text-[#b2c5e2] mb-4">Esta ação não pode ser desfeita. Digite a senha para confirmar.</p>
            
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Digite a senha..."
              className="w-full rounded-xl border border-[#2f466d] bg-[#091426] px-4 py-3 text-[#eef4ff] mb-4"
              onKeyPress={(e) => {
                if (e.key === "Enter" && deleteItemId) {
                  confirmDelete(deleteItemId);
                }
              }}
            />

            {error && <p className="mb-3 text-xs font-semibold text-[#ff8c98]">{error}</p>}

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setDeleteModalOpen(false);
                  setDeleteItemId(null);
                  setDeletePassword("");
                  setError("");
                }}
                className="flex-1 rounded-lg border border-[#365682] bg-[#13233f] px-4 py-3 font-bold text-[#d9e7ff] hover:bg-[#1a2f50] transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (deleteItemId) {
                    confirmDelete(deleteItemId);
                  }
                }}
                className="flex-1 rounded-lg bg-[#c81f2f] px-4 py-3 font-bold text-white hover:bg-[#b01625] transition"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedTableId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-[#365682] bg-[#0b1424] p-6 mx-4">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold text-white">Detalhes da Mesa {selectedTableId}</h3>
              <button
                onClick={() => setSelectedTableId(null)}
                className="rounded-lg border border-[#365682] bg-[#13233f] px-3 py-1 text-xs font-bold text-[#d9e7ff]"
              >
                Fechar
              </button>
            </div>

            <p className="mt-3 text-sm text-[#b2c5e2]">Total acumulado: {currency(selectedTableSummary?.total || 0)}</p>

            <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto pr-1">
              {selectedTableSummary && selectedTableSummary.orders.length > 0 ? (
                selectedTableSummary.orders.map((order) => (
                  <article key={order.id} className="rounded-xl border border-[#2b4062] bg-[#101d33] p-3">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-[#eef4ff]">{order.customerName}</p>
                      <p className="text-xs text-[#93a8c6]">{new Date(order.createdAt).toLocaleTimeString("pt-BR")}</p>
                    </div>
                    <ul className="mt-2 space-y-1 text-xs text-[#d6e3f8]">
                      {order.items.map((item) => (
                        <li key={`${order.id}-${item.itemId}`}>
                          {item.quantity}x {item.name}
                        </li>
                      ))}
                    </ul>
                    {order.notes && <p className="mt-2 text-xs italic text-[#93a8c6]">Obs: {order.notes}</p>}
                    <p className="mt-2 text-sm font-bold text-[#ff8c98]">{currency(order.total)}</p>
                  </article>
                ))
              ) : (
                <p className="text-sm text-[#93a8c6]">Nenhum consumo registrado para esta mesa.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
