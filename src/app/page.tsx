"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MenuCategory, MenuItem, Order, OrderItem } from "@/lib/types";

type CartStep = "items" | "confirm";

type CartLine = {
  lineId: string;
  itemId: string;
  name: string;
  imageUrl: string;
  basePrice: number;
  quantity: number;
  selectedAddons: string[];
  lineNote: string;
};

const ADDON_PRICE = 2.5;

function currency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function addonsSignature(addons: string[]) {
  return [...addons].sort((a, b) => a.localeCompare(b)).join("|");
}

function lineUnitPrice(line: CartLine) {
  return line.basePrice + line.selectedAddons.length * ADDON_PRICE;
}

function HomePageContent() {
  const searchParams = useSearchParams();
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [cartLines, setCartLines] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showDrawer, setShowDrawer] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<MenuCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCart, setShowCart] = useState(false);
  const [cartStep, setCartStep] = useState<CartStep>("items");
  const [tableId, setTableId] = useState("");
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);

  const [addonModalItem, setAddonModalItem] = useState<MenuItem | null>(null);
  const [addonDraft, setAddonDraft] = useState<string[]>([]);
  const [addonNoteDraft, setAddonNoteDraft] = useState("");
  const [editingLineId, setEditingLineId] = useState<string | null>(null);

  async function loadMenu() {
    const res = await fetch("/api/menu", { cache: "no-store" });
    const data = (await res.json()) as MenuItem[];
    setMenu(data.filter((item) => item.available));
  }

  useEffect(() => {
    loadMenu();
  }, []);

  useEffect(() => {
    const mesa = (searchParams.get("mesa") || "").trim();
    if (!mesa) return;
    setTableId(mesa);
    setCustomerName(`Mesa ${mesa}`);
  }, [searchParams]);

  useEffect(() => {
    const timer = setInterval(() => {
      loadMenu();
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function loadCustomerOrders() {
      if (!tableId && !customerName.trim()) {
        setCustomerOrders([]);
        return;
      }

      const res = await fetch("/api/orders", { cache: "no-store" });
      if (!res.ok) return;

      const allOrders = (await res.json()) as Order[];
      const filtered = allOrders.filter((order) => {
        if (tableId && order.tableId === tableId) return true;
        return customerName.trim().length > 0 && order.customerName.toLowerCase() === customerName.trim().toLowerCase();
      });

      setCustomerOrders(filtered);
    }

    loadCustomerOrders();
    const timer = setInterval(loadCustomerOrders, 4000);
    return () => clearInterval(timer);
  }, [tableId, customerName]);

  const filteredMenu = useMemo(() => {
    return menu.filter((item) => {
      const matchesCategory = !selectedCategory || item.category === selectedCategory;
      const text = `${item.name} ${item.description}`.toLowerCase();
      const matchesSearch = !searchQuery || text.includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [menu, selectedCategory, searchQuery]);

  const menuByCategory = useMemo(() => {
    const grouped: Record<string, MenuItem[]> = {};

    filteredMenu.forEach((item) => {
      if (!grouped[item.category]) {
        grouped[item.category] = [];
      }
      grouped[item.category].push(item);
    });

    return grouped;
  }, [filteredMenu]);

  const categories = useMemo(() => {
    return Object.keys(menuByCategory).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [menuByCategory]);

  const quantityByItem = useMemo(() => {
    const map: Record<string, number> = {};
    cartLines.forEach((line) => {
      map[line.itemId] = (map[line.itemId] || 0) + line.quantity;
    });
    return map;
  }, [cartLines]);

  const cartCount = useMemo(() => cartLines.reduce((acc, line) => acc + line.quantity, 0), [cartLines]);

  const total = useMemo(
    () => cartLines.reduce((acc, line) => acc + lineUnitPrice(line) * line.quantity, 0),
    [cartLines],
  );

  function openAddonModal(item: MenuItem, lineId?: string) {
    setAddonModalItem(item);

    if (lineId) {
      const line = cartLines.find((cartLine) => cartLine.lineId === lineId);
      setAddonDraft(line?.selectedAddons ?? []);
      setAddonNoteDraft(line?.lineNote ?? "");
      setEditingLineId(lineId);
      return;
    }

    setAddonDraft([]);
    setAddonNoteDraft("");
    setEditingLineId(null);
  }

  function closeAddonModal() {
    setAddonModalItem(null);
    setAddonDraft([]);
    setAddonNoteDraft("");
    setEditingLineId(null);
  }

  function toggleAddon(addon: string) {
    setAddonDraft((prev) => {
      if (prev.includes(addon)) {
        return prev.filter((value) => value !== addon);
      }
      return [...prev, addon];
    });
  }

  function upsertLine(item: MenuItem, selectedAddons: string[], lineNote = "") {
    const newSignature = addonsSignature(selectedAddons);

    setCartLines((prev) => {
      const existing = prev.find(
        (line) =>
          line.itemId === item.id &&
          addonsSignature(line.selectedAddons) === newSignature &&
          line.lineNote.trim() === lineNote.trim(),
      );

      if (existing) {
        return prev.map((line) =>
          line.lineId === existing.lineId ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }

      const newLine: CartLine = {
        lineId: crypto.randomUUID(),
        itemId: item.id,
        name: item.name,
        imageUrl: item.imageUrl,
        basePrice: item.price,
        quantity: 1,
        selectedAddons,
        lineNote: lineNote.trim(),
      };

      return [newLine, ...prev];
    });
  }

  function addFromCatalog(item: MenuItem) {
    if (item.addons && item.addons.length > 0) {
      openAddonModal(item);
      return;
    }

    upsertLine(item, [], "");
  }

  function removeFromCatalog(itemId: string) {
    setCartLines((prev) => {
      const index = prev.findIndex((line) => line.itemId === itemId);
      if (index === -1) return prev;

      const next = [...prev];
      if (next[index].quantity <= 1) {
        next.splice(index, 1);
      } else {
        next[index] = { ...next[index], quantity: next[index].quantity - 1 };
      }
      return next;
    });
  }

  function changeLineQuantity(lineId: string, delta: number) {
    setCartLines((prev) =>
      prev
        .map((line) => {
          if (line.lineId !== lineId) return line;
          return { ...line, quantity: Math.max(0, line.quantity + delta) };
        })
        .filter((line) => line.quantity > 0),
    );
  }

  function deleteLine(lineId: string) {
    setCartLines((prev) => prev.filter((line) => line.lineId !== lineId));
  }

  function saveAddonSelection() {
    if (!addonModalItem) return;

    if (editingLineId) {
      setCartLines((prev) =>
        prev.map((line) =>
          line.lineId === editingLineId
            ? { ...line, selectedAddons: addonDraft, lineNote: addonNoteDraft.trim() }
            : line,
        ),
      );
      closeAddonModal();
      return;
    }

    upsertLine(addonModalItem, addonDraft, addonNoteDraft);
    closeAddonModal();
  }

  async function submitOrder() {
    setMessage("");
    if (cartLines.length === 0) {
      setMessage("Adicione pelo menos um item no pedido.");
      return;
    }

    const items: OrderItem[] = cartLines.map((line) => ({
      itemId: line.itemId,
      name:
        line.selectedAddons.length > 0
          ? `${line.name} + ${line.selectedAddons.join(", ")}`
          : line.name,
      price: lineUnitPrice(line),
      quantity: line.quantity,
    })).map((item, index) => {
      const line = cartLines[index];
      if (!line?.lineNote?.trim()) return item;
      return {
        ...item,
        name: `${item.name} (Obs: ${line.lineNote.trim()})`,
      };
    });

    try {
      setLoading(true);
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableId,
          customerName: customerName.trim() || (tableId ? `Mesa ${tableId}` : "Cliente"),
          notes: "",
          items,
        }),
      });

      if (!res.ok) {
        setMessage("Nao foi possivel enviar o pedido.");
        return;
      }

      setMessage("Pedido enviado com sucesso! Seu pedido esta na cozinha.");
      setCartLines([]);
      setShowCart(false);
      setCartStep("items");
      setTimeout(() => setMessage(""), 3000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen flex-col bg-[#060b14] text-[#eef4ff]">
      <section
        className="relative h-52 w-full bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1400&q=80')",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[#020918]/90 via-[#0d2e70]/80 to-[#8f1722]/80" />
        <div className="relative flex h-full flex-col items-center pt-6 text-center text-white">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/60 bg-[#0a1a37]/65 text-lg font-bold shadow-lg">
            PS
          </div>
          <h1
            className="mt-2 text-4xl font-light tracking-[0.08em]"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Padaria Solar
          </h1>
        </div>
      </section>

      <section className="-mt-16 z-20 px-3 pb-3">
        <div className="rounded-2xl border border-[#1e2e48] bg-[#0b1424]/95 p-3 shadow-[0_14px_34px_rgba(0,0,0,0.55)] backdrop-blur-sm">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setShowDrawer(true)}
              className="rounded-xl border border-[#2c456d] bg-[#13233f] p-2.5 text-[#77a5ff]"
              aria-label="Abrir menu"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="h-6" />

            <button
              onClick={() => {
                setShowCart(true);
                setCartStep("items");
              }}
              className="relative rounded-xl border border-[#2c456d] bg-[#13233f] p-2.5 text-[#ff5b6a]"
              aria-label="Abrir carrinho"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.1}
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#c81f2f] px-1 text-[10px] font-bold text-white">
                  {cartCount}
                </span>
              )}
            </button>
          </div>

          <div className="mt-3">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar produto..."
              className="w-full rounded-xl border-2 border-[#2e476f] bg-[#091426] px-4 py-2.5 text-sm font-semibold text-[#e8f1ff] outline-none placeholder:text-[#8ca6cd] focus:border-[#0f5bd4]"
            />
          </div>
        </div>
      </section>

      {customerOrders.length > 0 && (
        <section className="px-3 pb-3">
          <div className="rounded-2xl border border-[#1f314f] bg-[#0b1424] p-3 shadow-[0_8px_18px_rgba(0,0,0,0.38)]">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8db5ff]">Acompanhamento do pedido</p>
            <div className="mt-2 space-y-2">
              {customerOrders.slice(0, 4).map((order) => (
                <div key={order.id} className="rounded-xl border border-[#2b4062] bg-[#101d33] px-3 py-2">
                  <p className="text-xs text-[#9bb0d0]">
                    Pedido {order.id.slice(0, 6)} - {new Date(order.createdAt).toLocaleTimeString("pt-BR")}
                  </p>
                  <p className="mt-1 text-sm font-bold text-[#eef4ff]">Status: {order.status}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <main className="flex-1 overflow-y-auto px-3 pb-6">
        {Object.entries(menuByCategory).map(([category, items]) =>
          items.length > 0 ? (
            <section
              key={category}
              className="mb-5 rounded-2xl border border-[#1f314f] bg-[#0b1424] p-2 shadow-[0_6px_22px_rgba(0,0,0,0.45)]"
            >
              <div className="rounded-xl bg-gradient-to-r from-[#0f3f91] to-[#0f5bd4] px-3 py-2 text-white">
                <h3 className="text-xs font-extrabold uppercase tracking-[0.16em]">{category}</h3>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                {items.map((item) => (
                  <article
                    key={item.id}
                    className="overflow-hidden rounded-xl border border-[#213554] bg-[#0f1b30]"
                  >
                    <img src={item.imageUrl} alt={item.name} className="h-24 w-full object-cover" />
                    <div className="space-y-1 p-2">
                      <p className="line-clamp-1 text-[11px] font-bold uppercase tracking-wide text-[#0f5bd4]">
                        {item.category}
                      </p>
                      <h4 className="line-clamp-2 text-sm font-extrabold leading-tight text-[#f2f7ff]">
                        {item.name}
                      </h4>
                      <p className="line-clamp-1 text-[11px] text-[#9bb0d0]">{item.description}</p>
                      <div className="flex items-center justify-between pt-1">
                        <strong className="text-base font-black text-[#c81f2f]">{currency(item.price)}</strong>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => removeFromCatalog(item.id)}
                            className="h-7 w-7 rounded-full border border-[#2f466d] bg-[#13233f] text-sm font-bold text-[#8db5ff]"
                          >
                            -
                          </button>
                          <span className="w-5 text-center text-xs font-bold text-[#e9f1ff]">
                            {quantityByItem[item.id] || 0}
                          </span>
                          <button
                            onClick={() => addFromCatalog(item)}
                            className="h-7 w-7 rounded-full bg-[#0f5bd4] text-sm font-bold text-white"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      {item.addons && item.addons.length > 0 && (
                        <p className="line-clamp-1 text-[10px] text-[#77a5ff]">Com acompanhamentos</p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null,
        )}
      </main>

      {showDrawer && (
        <div className="fixed inset-0 z-40 bg-[#020817]/50" onClick={() => setShowDrawer(false)}>
          <div
            className="absolute inset-y-0 left-0 w-72 bg-[#0b1424] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#1f314f] p-4">
              <h2 className="text-lg font-black text-[#eef4ff]">Categorias</h2>
              <button
                onClick={() => setShowDrawer(false)}
                className="rounded-lg p-1 text-[#8db5ff] hover:bg-[#13233f]"
              >
                X
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
                    ? "border-[#c81f2f] bg-[#35131a] text-[#ff6b78]"
                    : "border-[#2b4062] text-[#e6f0ff] hover:bg-[#13233f]"
                }`}
              >
                Todos
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setSelectedCategory(cat);
                    setShowDrawer(false);
                  }}
                  className={`w-full rounded-xl border px-4 py-3 text-left text-sm font-bold transition ${
                    selectedCategory === cat
                      ? "border-[#0f5bd4] bg-[#112849] text-[#8db5ff]"
                      : "border-[#2b4062] text-[#e6f0ff] hover:bg-[#13233f]"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      {addonModalItem && (
        <div className="fixed inset-0 z-50 animate-cart-backdrop bg-black/55" onClick={closeAddonModal}>
          <div className="flex min-h-full items-center justify-center px-4">
            <div
              className="w-full max-w-sm animate-cart-sheet rounded-2xl border border-[#2b4062] bg-[#0b1424] p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-black text-white">Acompanhamentos</h3>
              <p className="mt-1 text-sm text-[#9bb0d0]">{addonModalItem.name}</p>
              <p className="mt-1 text-xs text-[#77a5ff]">Cada adicional: {currency(ADDON_PRICE)}</p>

              <div className="mt-4 space-y-2">
                {(addonModalItem.addons ?? []).map((addon) => (
                  <button
                    key={addon}
                    onClick={() => toggleAddon(addon)}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${
                      addonDraft.includes(addon)
                        ? "border-[#0f5bd4] bg-[#112849] text-[#cfe1ff]"
                        : "border-[#2b4062] bg-[#0f1b30] text-[#d9e7ff]"
                    }`}
                  >
                    {addon}
                  </button>
                ))}

                <div className="pt-1">
                  <label className="mb-1 block text-xs font-bold text-[#9bb0d0]">Observacao do item (opcional)</label>
                  <textarea
                    value={addonNoteDraft}
                    onChange={(e) => setAddonNoteDraft(e.target.value)}
                    placeholder="Ex: Bem passado, sem molho..."
                    className="h-20 w-full resize-none rounded-xl border border-[#2b4062] bg-[#0f1b30] px-3 py-2 text-sm text-[#d9e7ff] outline-none focus:border-[#0f5bd4]"
                  />
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={closeAddonModal}
                  className="flex-1 rounded-xl border border-[#2b4062] px-3 py-2 text-sm font-bold text-[#9bb0d0]"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveAddonSelection}
                  className="flex-1 rounded-xl bg-[#0f5bd4] px-3 py-2 text-sm font-bold text-white"
                >
                  {editingLineId ? "Salvar" : "Adicionar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCart && (
        <div className="fixed inset-0 z-40 animate-cart-backdrop bg-[#020817]/50" onClick={() => setShowCart(false)}>
          <div className="flex min-h-full items-end" onClick={(e) => e.stopPropagation()}>
            <div className="animate-cart-sheet w-full bg-[#0b1424] shadow-2xl" style={{ maxHeight: "90vh" }}>
              <div className="flex items-center justify-between border-b border-[#1f314f] p-4">
                <h2 className="text-lg font-black text-[#eef4ff]">Seu Pedido</h2>
                <button
                  onClick={() => setShowCart(false)}
                  className="rounded-lg p-1 text-[#8db5ff] hover:bg-[#13233f]"
                >
                  X
                </button>
              </div>

              <div className="flex gap-2 border-b border-[#1f314f] p-4">
                <button
                  onClick={() => setCartStep("items")}
                  className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
                    cartStep === "items" ? "bg-[#c81f2f] text-white" : "bg-[#13233f] text-[#8db5ff]"
                  }`}
                >
                  Itens
                </button>
                <button
                  onClick={() => cartLines.length > 0 && setCartStep("confirm")}
                  disabled={cartLines.length === 0}
                  className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
                    cartStep === "confirm"
                      ? "bg-[#c81f2f] text-white"
                      : cartLines.length === 0
                        ? "bg-[#0f182b] text-[#5c6f91]"
                        : "bg-[#13233f] text-[#8db5ff]"
                  }`}
                >
                  Confirmar
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {cartStep === "items" && (
                  <div className="space-y-3">
                    {cartLines.length === 0 ? (
                      <p className="text-center text-sm text-[#9bb0d0]">Carrinho vazio</p>
                    ) : (
                      cartLines.map((line) => {
                        const item = menu.find((menuItem) => menuItem.id === line.itemId);
                        return (
                          <div key={line.lineId} className="rounded-xl border border-[#243a5c] bg-[#13233f] p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <p className="text-sm font-bold text-[#eef4ff]">{line.name}</p>
                                {line.selectedAddons.length > 0 && (
                                  <p className="mt-1 text-xs text-[#8db5ff]">
                                    + {line.selectedAddons.join(", ")}
                                  </p>
                                )}
                                {line.lineNote && (
                                  <p className="mt-1 text-xs italic text-[#b7cbe8]">Obs item: {line.lineNote}</p>
                                )}
                                <p className="mt-1 text-xs text-[#9bb0d0]">
                                  Unitario: {currency(lineUnitPrice(line))}
                                </p>
                              </div>
                              <strong className="text-sm text-[#ff6b78]">
                                {currency(lineUnitPrice(line) * line.quantity)}
                              </strong>
                            </div>

                            <div className="mt-3 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => changeLineQuantity(line.lineId, -1)}
                                  className="h-7 w-7 rounded-full border border-[#2f466d] bg-[#0f1b30] text-sm font-bold text-[#8db5ff]"
                                >
                                  -
                                </button>
                                <span className="w-5 text-center text-xs font-bold text-[#e9f1ff]">{line.quantity}</span>
                                <button
                                  onClick={() => changeLineQuantity(line.lineId, 1)}
                                  className="h-7 w-7 rounded-full bg-[#0f5bd4] text-sm font-bold text-white"
                                >
                                  +
                                </button>
                              </div>

                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    if (item) openAddonModal(item, line.lineId);
                                  }}
                                  disabled={!item?.addons || item.addons.length === 0}
                                  className="rounded-lg border border-[#2f466d] px-2 py-1 text-[11px] font-bold text-[#8db5ff] disabled:opacity-40"
                                >
                                  Editar
                                </button>
                                <button
                                  onClick={() => deleteLine(line.lineId)}
                                  className="rounded-lg border border-[#5f1e28] px-2 py-1 text-[11px] font-bold text-[#ff8c98]"
                                >
                                  Excluir
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}

                    {cartLines.length > 0 && (
                      <div className="mt-4 rounded-lg bg-[#13233f] p-3">
                        <div className="flex justify-between">
                          <span className="font-bold text-[#eef4ff]">Total</span>
                          <span className="text-lg font-bold text-[#ff6b78]">{currency(total)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {cartStep === "confirm" && (
                  <div className="space-y-3">
                    <div className="rounded-lg bg-[#13233f] p-3">
                      <p className="text-xs font-bold text-[#9bb0d0]">Nome/Mesa</p>
                      <p className="mt-1 text-sm font-bold text-[#eef4ff]">{customerName}</p>
                    </div>

                    <div className="rounded-lg bg-[#13233f] p-3">
                      <p className="text-xs font-bold text-[#9bb0d0]">Itens do Pedido</p>
                      <ul className="mt-2 space-y-1">
                        {cartLines.map((line) => (
                          <li key={line.lineId} className="flex justify-between text-sm text-[#eef4ff]">
                            <span>
                              {line.quantity}x {line.name}
                              {line.selectedAddons.length > 0 && ` + ${line.selectedAddons.join(", ")}`}
                              {line.lineNote && ` (Obs: ${line.lineNote})`}
                            </span>
                            <span className="font-bold">{currency(lineUnitPrice(line) * line.quantity)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-lg border-t-2 border-[#c81f2f] bg-[#091426] p-3">
                      <div className="flex justify-between">
                        <span className="font-bold text-[#eef4ff]">Total a Pagar</span>
                        <span className="text-2xl font-bold text-[#ff6b78]">{currency(total)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {message && (
                  <div className="mt-3 rounded-lg bg-[#13233f] p-3">
                    <p className="text-center text-xs font-bold text-[#eaf2ff]">{message}</p>
                  </div>
                )}
              </div>

              <div className="border-t border-[#1f314f] p-4">
                {cartStep === "items" && (
                  <button
                    onClick={() => cartLines.length > 0 && setCartStep("confirm")}
                    disabled={cartLines.length === 0}
                    className="w-full rounded-lg bg-[#c81f2f] px-4 py-3 font-bold text-white transition hover:brightness-95 disabled:opacity-50"
                  >
                    Continuar
                  </button>
                )}
                {cartStep === "confirm" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCartStep("items")}
                      className="flex-1 rounded-lg border border-[#2f466d] px-4 py-3 font-bold text-[#8db5ff] transition hover:bg-[#13233f]"
                    >
                      Voltar
                    </button>
                    <button
                      onClick={submitOrder}
                      disabled={loading}
                      className="flex-1 rounded-lg bg-gradient-to-r from-[#c81f2f] to-[#0f5bd4] px-4 py-3 font-bold text-white transition hover:brightness-95 disabled:opacity-50"
                    >
                      {loading ? "Enviando..." : "Enviar para cozinha"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#060b14] text-[#d6e3f8]">
          <p className="text-sm font-semibold uppercase tracking-[0.14em]">Carregando cardapio...</p>
        </main>
      }
    >
      <HomePageContent />
    </Suspense>
  );
}
