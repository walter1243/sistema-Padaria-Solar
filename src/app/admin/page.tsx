"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Addon,
  MenuCategory,
  MenuItem,
  Order,
  OrderStatus,
  PaymentMethod,
  PaymentRecord,
  TableReceipt,
  UnitMeasure,
} from "@/lib/types";

const statusFlow: OrderStatus[] = ["novo", "preparando", "pronto", "entregue"];

type AdminSection = "dashboard" | "menu" | "tables" | "orders" | "reports" | "profile";

type ReportsSummary = {
  totalPaid: number;
  totalsByMethod: {
    dinheiro: number;
    pix: number;
    cartao: number;
  };
  payments: PaymentRecord[];
};

type TableSummary = {
  tableId: string;
  total: number;
  count: number;
  orders: Order[];
};

type CloseTableResponse = {
  closedOrders: number;
  total: number;
  payment: PaymentRecord | null;
  receipt: TableReceipt | null;
};

const LAST_RECEIPT_STORAGE_KEY = "padaria:last-printed-receipt";
const THERMAL_BRIDGE_URL = "http://127.0.0.1:8765";

type ProductDraft = {
  name: string;
  description: string;
  price: string;
  category: MenuCategory;
  unit: UnitMeasure;
  imageUrl: string;
  addonsList: Addon[];
};

function currency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function paymentMethodLabel(method: PaymentMethod) {
  const labels: Record<PaymentMethod, string> = {
    dinheiro: "Dinheiro",
    pix: "Pix",
    cartao: "Cartao",
  };
  return labels[method];
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildReceiptHtml(receipt: TableReceipt) {
  const lines = receipt.lines
    .map((line) => {
      const qty = String(line.quantity).padEnd(3);
      const desc = escapeHtml(line.description).substring(0, 19).padEnd(19);
      const valor = currency(line.total).padStart(12).substring(0, 12);
      return `${qty} ${desc} ${valor}`;
    })
    .map((line) => `<div class="item-line">${line}</div>`)
    .join("");

  const closedAt = new Date(receipt.closedAt).toLocaleString("pt-BR");
  const paymentText = paymentMethodLabel(receipt.method);
  
  const divider = "-".repeat(42);
  const cutLine = "_".repeat(42);

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Cupom Mesa ${receipt.tableId}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 80mm; }
      body { 
        font-family: 'Courier New', monospace; 
        color: #000;
        background: #fff;
        padding: 4px;
        font-size: 14px;
        font-weight: 600;
        line-height: 1.3;
      }
      .container { width: 100%; }
      .center { text-align: center; }
      .right { text-align: right; }
      .bold { font-weight: 700; }
      .divider { margin: 3px 0; white-space: pre; font-weight: 600; }
      .cut-line { margin: 4px 0; white-space: pre; font-weight: 700; border-top: 2px dashed #000; padding-top: 2px; }
      .header { font-weight: 700; margin: 2px 0; }
      .title { font-size: 16px; font-weight: 800; letter-spacing: 1px; }
      .subtitle { font-size: 14px; font-weight: 700; }
      .item-line { 
        font-family: 'Courier New', monospace; 
        white-space: pre; 
        font-size: 13px;
        font-weight: 600;
      }
      .totals { 
        margin: 4px 0; 
        font-weight: 800; 
        font-size: 15px;
        text-align: right;
      }
      .payment { 
        margin: 4px 0; 
        font-weight: 700;
        font-size: 13px;
      }
      .meta { 
        margin: 2px 0; 
        font-size: 12px;
        font-weight: 600;
      }
      .info { 
        font-size: 12px; 
        font-weight: 600;
      }
      @media print {
        body { width: 80mm; padding: 0; margin: 0; }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <!-- Header -->
      <div class="center">
        <div class="title">PADARIA SOLAR</div>
        <div class="subtitle">SUPERMERCADO</div>
        <div class="info">CNPJ: 13.487.922/0001-17</div>
        <div class="info bold">Mesa ${receipt.tableId}</div>
      </div>
      
      <div class="divider">${divider}</div>
      
      <!-- Items Header -->
      <div class="bold" style="font-size: 13px;">QTD DESC               VALOR</div>
      <div class="divider">${divider}</div>
      
      <!-- Items -->
      ${lines}
      
      <!-- Totals -->
      <div class="divider">${divider}</div>
      <div class="totals">TOTAL: R$ ${(receipt.total / 100).toFixed(2).replace(".", ",")}</div>
      
      <!-- Payment Method -->
      <div class="payment">PAGO: ${paymentText}</div>
      
      <!-- Footer -->
      <div class="meta right">${closedAt}</div>
      
      <!-- Cut Line -->
      <div class="cut-line">${cutLine}</div>
    </div>
  </body>
</html>`;
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
  const [addonsList, setAddonsList] = useState<Addon[]>([]);
  const [newAddonName, setNewAddonName] = useState("");
  const [newAddonPrice, setNewAddonPrice] = useState("");
  const [newAddonDesc, setNewAddonDesc] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [activeSection, setActiveSection] = useState<AdminSection>("dashboard");
  const [formNotice, setFormNotice] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [kitchenUser, setKitchenUser] = useState("");
  const [kitchenPass, setKitchenPass] = useState("");
  const [adminUser, setAdminUser] = useState("");
  const [adminCurrentPassword, setAdminCurrentPassword] = useState("");
  const [adminNewPassword, setAdminNewPassword] = useState("");
  const [adminConfirmPassword, setAdminConfirmPassword] = useState("");
  const [reports, setReports] = useState<ReportsSummary | null>(null);
  const [tableSummaries, setTableSummaries] = useState<TableSummary[]>([]);
  const [showProductForm, setShowProductForm] = useState(false);
  const [showKitchenAuthEditor, setShowKitchenAuthEditor] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Estados para edição e pesquisa
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchCategory, setSearchCategory] = useState<MenuCategory | "">("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteCategoryModalOpen, setDeleteCategoryModalOpen] = useState(false);
  const [deleteCategoryName, setDeleteCategoryName] = useState("");
  const [deleteCategoryPassword, setDeleteCategoryPassword] = useState("");
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [closeTableId, setCloseTableId] = useState<string | null>(null);
  const [closePaymentMethod, setClosePaymentMethod] = useState<PaymentMethod>("dinheiro");
  const [receiptModal, setReceiptModal] = useState<TableReceipt | null>(null);
  const [lastPrintedReceipt, setLastPrintedReceipt] = useState<TableReceipt | null>(null);
  const [isDesktopPrintEnabled, setIsDesktopPrintEnabled] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  async function loadData() {
    const [menuRes, ordersRes, categoriesRes, bakerRes, adminRes, reportsRes, tablesRes] = await Promise.all([
      fetch("/api/menu", { cache: "no-store" }),
      fetch("/api/orders", { cache: "no-store" }),
      fetch("/api/categories", { cache: "no-store" }),
      fetch("/api/baker/credentials", { cache: "no-store" }),
      fetch("/api/admin/profile", { cache: "no-store" }),
      fetch("/api/reports/summary", { cache: "no-store" }),
      fetch("/api/tables/active", { cache: "no-store" }),
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

    if (adminRes.ok) {
      const adminData = (await adminRes.json()) as { username: string };
      setAdminUser(adminData.username || "");
    }

    if (reportsRes.ok) {
      const reportData = (await reportsRes.json()) as ReportsSummary;
      setReports(reportData);
    }

    if (tablesRes.ok) {
      const tablesData = (await tablesRes.json()) as TableSummary[];
      setTableSummaries(tablesData);
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
      // Usa a URL configurada em NEXT_PUBLIC_BASE_URL (produção).
      // Se não estiver definida, usa a origem atual (localhost em dev).
      const envUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim();
      setBaseUrl(envUrl && envUrl.length > 0 ? envUrl : window.location.origin);
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const serialized = window.localStorage.getItem(LAST_RECEIPT_STORAGE_KEY);
    if (!serialized) return;

    try {
      const parsed = JSON.parse(serialized) as TableReceipt;
      setLastPrintedReceipt(parsed);
    } catch {
      window.localStorage.removeItem(LAST_RECEIPT_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const widthMedia = window.matchMedia("(min-width: 768px)");
    const pointerMedia = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setIsDesktopPrintEnabled(widthMedia.matches || pointerMedia.matches);
    update();

    widthMedia.addEventListener("change", update);
    pointerMedia.addEventListener("change", update);
    return () => {
      widthMedia.removeEventListener("change", update);
      pointerMedia.removeEventListener("change", update);
    };
  }, []);

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

  function printReceipt(receipt: TableReceipt) {
    if (typeof window === "undefined") return;

    const printWindow = window.open("", "_blank", "width=420,height=720");
    if (!printWindow) {
      setError("Nao foi possivel abrir a janela de impressao. Verifique o bloqueio de pop-up.");
      return;
    }

    const html = buildReceiptHtml(receipt);
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  }

  async function printWithThermalBridge(receipt: TableReceipt) {
    console.log("[PRINT] Iniciando impressão para", THERMAL_BRIDGE_URL, receipt);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`${THERMAL_BRIDGE_URL}/print-receipt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(receipt),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      console.log("[PRINT] Resposta recebida:", response.status, response.ok);

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Falha ao imprimir na termica.");
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        throw new Error("Timeout: serviço local demorou muito ou não respondeu. Verifique: 1) npm run printer:service está rodando? 2) Firewall permite 127.0.0.1:8765?");
      }
      throw e;
    }
  }

  async function reprintWithThermalBridge() {
    console.log("[REPRINT] Iniciando reimpressão para", THERMAL_BRIDGE_URL);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`${THERMAL_BRIDGE_URL}/reprint-last`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      console.log("[REPRINT] Resposta recebida:", response.status, response.ok);

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Falha ao reimprimir na termica.");
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        throw new Error("Timeout: serviço local não respondeu. Verifique se npm run printer:service está rodando.");
      }
      throw e;
    }
  }

  async function handlePrintReceipt(receipt: TableReceipt) {
    setLastPrintedReceipt(receipt);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LAST_RECEIPT_STORAGE_KEY, JSON.stringify(receipt));
    }

    if (!isDesktopPrintEnabled) {
      setError("Impressão desabilitada neste dispositivo (apenas desktop/tablet com impressora).");
      return;
    }

    setIsPrinting(true);
    setError("");
    setFormNotice("Enviando cupom para impressora...");

    try {
      console.log("[HANDLE] Iniciando impressão...");
      await printWithThermalBridge(receipt);
      setFormNotice("✓ Cupom enviado para impressora termica!");
      setTimeout(() => setIsPrinting(false), 2000);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao imprimir na termica.";
      console.error("[HANDLE] Erro ao imprimir:", error);
      setError(`ERRO: ${message}\n\nVerifique:\n1. npm run printer:service está rodando?\n2. Impressora ELGIN i9(USB) conectada?\n3. Firewall permite conexão 127.0.0.1:8765?`);
      setFormNotice("✗ Impressão falhou - veja erros acima");
      setIsPrinting(false);
    }
  }

  async function handleReprintLastReceipt() {
    if (!isDesktopPrintEnabled) {
      setError("Reimpressão desabilitada neste dispositivo (apenas desktop/tablet com impressora).");
      return;
    }

    if (!lastPrintedReceipt) {
      setError("Ainda nao existe cupom anterior impresso para reimprimir.");
      return;
    }

    setIsPrinting(true);
    setError("");
    setFormNotice("Enviando reimpressão para impressora...");

    try {
      console.log("[HANDLE] Iniciando reimpressão...");
      await reprintWithThermalBridge();
      setFormNotice("✓ Reimpressão enviada para impressora!");
      setTimeout(() => setIsPrinting(false), 2000);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao reimprimir na termica.";
      console.error("[HANDLE] Erro ao reimprimir:", error);
      setError(`ERRO: ${message}\n\nVerifique:\n1. npm run printer:service está rodando?\n2. Impressora ELGIN i9(USB) conectada?`);
      setFormNotice("✗ Reimpressão falhou - veja erros acima");
      setIsPrinting(false);
    }
  }

  useEffect(() => {
    if (!authorized || typeof window === "undefined") return;

    function onKeyDown(event: KeyboardEvent) {
      if (!isDesktopPrintEnabled) return;
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "p") return;
      if (!lastPrintedReceipt) return;

      event.preventDefault();
      void handleReprintLastReceipt();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [authorized, isDesktopPrintEnabled, lastPrintedReceipt]);

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

  function openSection(section: AdminSection) {
    setActiveSection(section);
    setMobileMenuOpen(false);
  }

  function applyDraftToForm(draft: ProductDraft) {
    setName(draft.name || "");
    setDescription(draft.description || "");
    setPrice(draft.price || "");
    setCategory(draft.category || "Salgado");
    setUnit(draft.unit || "un");
    setImageUrl(draft.imageUrl || "");
    setAddonsList(draft.addonsList || []);
  }

  function buildDraftFromItem(item: MenuItem): ProductDraft {
    return {
      name: item.name,
      description: item.description,
      price: String(item.price),
      category: item.category,
      unit: item.unit,
      imageUrl: item.imageUrl,
      addonsList: item.addons || [],
    };
  }

  const handleImagePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) {
          convertImageToDataUrl(file);
        }
        return;
      }
    }
  };

  const handleImageDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer?.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      if (files[i].type.startsWith("image/")) {
        convertImageToDataUrl(files[i]);
        return;
      }
    }
  };

  const handleImageDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const convertImageToDataUrl = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setImageUrl(result);
      setFormNotice("Imagem carregada com sucesso.");
    };
    reader.readAsDataURL(file);
  };

  async function addMenu(e: FormEvent) {
    e.preventDefault();

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
        addons: addonsList,
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
    setAddonsList([]);
    setNewAddonName("");
    setNewAddonPrice("");
    setNewAddonDesc("");
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

  async function saveAdminProfile() {
    const username = adminUser.trim();
    const currentPassword = adminCurrentPassword.trim();
    const newPassword = adminNewPassword.trim();
    const confirmPassword = adminConfirmPassword.trim();

    if (!username || !currentPassword || !newPassword || !confirmPassword) {
      setError("Preencha usuario, senha atual, nova senha e confirmacao para salvar o perfil.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("A confirmacao da nova senha nao confere.");
      return;
    }

    const res = await fetch("/api/admin/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, currentPassword, newPassword }),
    });

    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      setError(payload.error || "Nao foi possivel atualizar o perfil do admin.");
      return;
    }

    const data = (await res.json()) as { username: string };
    setAdminUser(data.username || username);
    setAdminCurrentPassword("");
    setAdminNewPassword("");
    setAdminConfirmPassword("");
    setError("");
    setFormNotice("Perfil do admin atualizado com sucesso.");
  }

  async function addMenuCategory() {
    const name = newCategoryName.trim();
    if (!name) {
      setError("Informe o nome da categoria para adicionar.");
      return;
    }

    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      setError(payload.error || "Nao foi possivel adicionar categoria.");
      return;
    }

    setNewCategoryName("");
    setError("");
    setFormNotice("Categoria adicionada com sucesso.");
    await loadData();
    setCategory(name as MenuCategory);
  }

  async function removeMenuCategory(categoryName: string) {
    setDeleteCategoryName(categoryName);
    setDeleteCategoryPassword("");
    setDeleteCategoryModalOpen(true);
  }

  async function confirmDeleteMenuCategory() {
    if (deleteCategoryPassword !== "1234") {
      setError("Senha incorreta. Use 1234 para confirmar a exclusao da categoria.");
      return;
    }

    const categoryName = deleteCategoryName.trim();
    const res = await fetch("/api/categories", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: categoryName }),
    });

    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      setError(payload.error || "Nao foi possivel remover categoria.");
      return;
    }

    setError("");
    setFormNotice(`Categoria ${categoryName} removida com sucesso.`);
    setDeleteCategoryModalOpen(false);
    setDeleteCategoryName("");
    setDeleteCategoryPassword("");
    await loadData();

    if (category === categoryName) {
      setCategory("Salgado");
    }
    if (searchCategory === categoryName) {
      setSearchCategory("");
    }
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
        addons: addonsList,
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
    setAddonsList([]);
    setNewAddonName("");
    setNewAddonPrice("");
    setNewAddonDesc("");
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

    const data = (await res.json()) as CloseTableResponse;

    setCloseTableId(null);
    setClosePaymentMethod("dinheiro");
    setError("");
    setFormNotice("Mesa fechada com pagamento registrado com sucesso.");
    if (data.receipt) {
      setReceiptModal(data.receipt);
    }
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
          className="absolute inset-0 bg-cover bg-center brightness-[0.94] contrast-[1.1] saturate-[1.08]"
          style={{
            backgroundImage: "url('/images/capa-solar-supermercado.jpg')",
          }}
        />
        <div className="absolute inset-0 bg-[#020917]/68" />

        <form
          onSubmit={login}
          className="relative z-10 w-full max-w-md rounded-3xl border border-white/14 bg-black/80 p-6 shadow-[0_24px_50px_rgba(0,0,0,0.7)] backdrop-blur-md"
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
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 border-r border-[#244063] bg-[#0b1424] flex flex-col transform transition-transform duration-200 md:static md:w-64 md:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="border-b border-[#244063] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8db5ff]">Painel Admin</p>
          <h1 className="text-xl font-bold text-white mt-2">Padaria Solar</h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => openSection("dashboard")}
            className={`w-full text-left px-4 py-3 rounded-lg text-sm font-bold transition ${
              activeSection === "dashboard"
                ? "bg-gradient-to-r from-[#c81f2f] to-[#0f5bd4] text-white"
                : "text-[#d3e4ff] hover:bg-[#13233f]"
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => openSection("menu")}
            className={`w-full text-left px-4 py-3 rounded-lg text-sm font-bold transition ${
              activeSection === "menu"
                ? "bg-gradient-to-r from-[#c81f2f] to-[#0f5bd4] text-white"
                : "text-[#d3e4ff] hover:bg-[#13233f]"
            }`}
          >
            📦 Cadastro de Produtos
          </button>
          <button
            onClick={() => openSection("tables")}
            className={`w-full text-left px-4 py-3 rounded-lg text-sm font-bold transition ${
              activeSection === "tables"
                ? "bg-gradient-to-r from-[#c81f2f] to-[#0f5bd4] text-white"
                : "text-[#d3e4ff] hover:bg-[#13233f]"
            }`}
          >
            🪑 Mesas
          </button>
          <button
            onClick={() => openSection("orders")}
            className={`w-full text-left px-4 py-3 rounded-lg text-sm font-bold transition ${
              activeSection === "orders"
                ? "bg-gradient-to-r from-[#c81f2f] to-[#0f5bd4] text-white"
                : "text-[#d3e4ff] hover:bg-[#13233f]"
            }`}
          >
            📋 Pedidos
          </button>
          <button
            onClick={() => openSection("reports")}
            className={`w-full text-left px-4 py-3 rounded-lg text-sm font-bold transition ${
              activeSection === "reports"
                ? "bg-gradient-to-r from-[#c81f2f] to-[#0f5bd4] text-white"
                : "text-[#d3e4ff] hover:bg-[#13233f]"
            }`}
          >
            📈 Relatorio
          </button>
          <button
            onClick={() => openSection("profile")}
            className={`w-full text-left px-4 py-3 rounded-lg text-sm font-bold transition ${
              activeSection === "profile"
                ? "bg-gradient-to-r from-[#c81f2f] to-[#0f5bd4] text-white"
                : "text-[#d3e4ff] hover:bg-[#13233f]"
            }`}
          >
            👤 Perfil
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
            onClick={() => setMobileMenuOpen(false)}
            className="block w-full text-center px-4 py-2 rounded-lg border border-[#365682] bg-[#13233f] text-xs font-bold text-[#d9e7ff] hover:bg-[#1a2f50] transition"
            title="Cardápio do cliente"
          >
            🍽️ Cardápio
          </a>
          <a
            href="/kitchen"
            onClick={() => setMobileMenuOpen(false)}
            className="block w-full text-center px-4 py-2 rounded-lg border border-[#c81f2f] bg-[#c81f2f]/10 text-xs font-bold text-[#ff8c98] hover:bg-[#c81f2f]/20 transition"
            title="Painel separado da cozinha"
          >
            👨‍🍳 Padaria
          </a>
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              logout();
            }}
            className="w-full px-4 py-2 rounded-lg border border-[#365682] bg-[#13233f] text-xs font-bold text-[#d9e7ff] hover:bg-[#1a2f50] transition"
          >
            🚪 Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 overflow-auto md:ml-0">
        <div className="min-h-screen p-4 md:p-6">
          {/* Header */}
          <header className="mb-6">
            <div className="mb-3 flex items-center justify-between md:hidden">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="rounded-lg border border-[#365682] bg-[#13233f] px-3 py-2 text-xs font-bold text-[#d9e7ff]"
              >
                Menu
              </button>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#8db5ff]">Padaria Solar</p>
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8db5ff]">Painel Administrativo</p>
            <h1 className="text-2xl font-bold text-white mt-2 md:text-4xl">
              {activeSection === "dashboard" && "Dashboard"}
              {activeSection === "menu" && "Cadastro de Produtos"}
              {activeSection === "tables" && "Mesas"}
              {activeSection === "orders" && "Pedidos"}
              {activeSection === "reports" && "Relatorio da Padaria"}
              {activeSection === "profile" && "Perfil do Administrador"}
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

                <section className="rounded-2xl border border-[#234062] bg-[#0b1424] p-4 shadow-[0_10px_24px_rgba(0,0,0,0.35)]">
                  <h2 className="text-xl font-bold text-white">Categorias do cardapio</h2>
                  <p className="mt-1 text-xs text-[#9bb0d0]">Adicione ou remova categorias usadas no cadastro de produtos.</p>

                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="Nova categoria"
                      className="w-full rounded-xl border border-[#2f466d] bg-[#091426] px-3 py-2 text-[#eef4ff]"
                    />
                    <button
                      type="button"
                      onClick={addMenuCategory}
                      className="rounded-xl bg-gradient-to-r from-[#0f5bd4] to-[#0f5bd4] px-4 py-2 font-bold text-white"
                    >
                      Adicionar
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {categories.map((cat) => (
                      <div
                        key={cat}
                        className="flex items-center gap-2 rounded-lg border border-[#2b4062] bg-[#101d33] px-3 py-2"
                      >
                        <span className="text-xs font-bold uppercase tracking-[0.06em] text-[#d6e3f8]">{cat}</span>
                        <button
                          type="button"
                          onClick={() => removeMenuCategory(cat)}
                          className="rounded px-2 py-1 text-xs font-bold text-[#ff8c98] hover:bg-[#1a2a3f]"
                        >
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

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
                    <div
                      onDrop={handleImageDrop}
                      onDragOver={handleImageDragOver}
                      className="w-full rounded-xl border-2 border-dashed border-[#2f466d] bg-[#091426] px-3 py-4 transition-colors hover:border-[#0f5bd4]"
                    >
                      <input
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        onPaste={handleImagePaste}
                        placeholder="Cole a imagem ou arraste para cá (Ctrl+V ou drag-drop)"
                        className="w-full bg-transparent text-[#eef4ff] placeholder-[#7a95bd] outline-none"
                      />
                      {imageUrl && (
                        <div className="mt-2 overflow-hidden rounded-lg">
                          <img src={imageUrl} alt="preview" className="h-20 w-auto object-cover" />
                        </div>
                      )}
                    </div>

                    {/* Acompanhamentos */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-bold text-[#eef4ff]">Acompanhamentos</h4>
                      
                      {/* Lista de acompanhamentos */}
                      <div className="space-y-2">
                        {addonsList.map((addon, idx) => (
                          <div key={idx} className="flex items-center gap-2 rounded-lg border border-[#2b4062] bg-[#101d33] p-2">
                            <div className="flex-1 text-xs text-[#d6e3f8]">
                              <p className="font-bold">{addon.name}</p>
                              <p className="text-[#93a8c6]">{addon.description}</p>
                              <p className="text-[#8db5ff] font-semibold">{currency(addon.price)}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setAddonsList(addonsList.filter((_, i) => i !== idx))}
                              className="rounded px-2 py-1 text-xs font-bold text-[#ff8c98] hover:bg-[#1a2a3f]"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Formulário para adicionar novo acompanhamento */}
                      <div className="space-y-2 rounded-lg border border-[#2f466d] bg-[#091426] p-3">
                        <input
                          value={newAddonName}
                          onChange={(e) => setNewAddonName(e.target.value)}
                          placeholder="Nome do acompanhamento"
                          className="w-full rounded-lg border border-[#1f3a52] bg-[#0a0f1a] px-2 py-1 text-xs text-[#eef4ff]"
                        />
                        <input
                          value={newAddonPrice}
                          onChange={(e) => setNewAddonPrice(e.target.value)}
                          placeholder="Preço"
                          type="number"
                          step="0.01"
                          className="w-full rounded-lg border border-[#1f3a52] bg-[#0a0f1a] px-2 py-1 text-xs text-[#eef4ff]"
                        />
                        <input
                          value={newAddonDesc}
                          onChange={(e) => setNewAddonDesc(e.target.value)}
                          placeholder="Descrição"
                          className="w-full rounded-lg border border-[#1f3a52] bg-[#0a0f1a] px-2 py-1 text-xs text-[#eef4ff]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (newAddonName.trim() && newAddonPrice.trim()) {
                              setAddonsList([
                                ...addonsList,
                                {
                                  name: newAddonName,
                                  price: Number(newAddonPrice),
                                  description: newAddonDesc,
                                },
                              ]);
                              setNewAddonName("");
                              setNewAddonPrice("");
                              setNewAddonDesc("");
                            }
                          }}
                          className="w-full rounded-lg bg-[#0f5bd4] px-2 py-1 text-xs font-bold text-white"
                        >
                          + Adicionar
                        </button>
                      </div>
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
                            setAddonsList([]);
                            setNewAddonName("");
                            setNewAddonPrice("");
                            setNewAddonDesc("");
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
                        <div className="mt-2 overflow-hidden rounded-lg border border-[#2b4062] bg-[#0b1424]">
                          <img src={item.imageUrl} alt={item.name} className="h-24 w-full object-cover" />
                        </div>
                        {item.addons && item.addons.length > 0 && (
                          <p className="mt-2 text-xs text-[#97afcf]">
                            Acompanhamentos: {item.addons.map((addon) => addon.name).join(", ")}
                          </p>
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
                  {Array.from({ length: 11 }).map((_, index) => {
                    const tableId = String(index + 1);
                    const orderLink = `${baseUrl}/?mesa=${tableId}`;
                    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(orderLink)}`;
                    const summary = tableSummaries.find((table) => table.tableId === tableId);
                    const isOccupied = Boolean(summary && summary.total > 0);
                    const isCashierQuickTable = tableId === "11";

                    return (
                      <article key={tableId} className="rounded-2xl border border-[#2a4162] bg-[#101d33] p-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xl text-white">Mesa {tableId}</h3>
                          <span className={`text-xs font-bold ${isOccupied ? "text-[#ff8c98]" : "text-[#8fe0b8]"}`}>
                            {isOccupied ? "Ocupada" : "Livre"}
                          </span>
                        </div>

                        {isCashierQuickTable && (
                          <p className="mt-2 rounded-lg border border-[#2e476f] bg-[#13233f] px-2 py-1 text-xs font-bold text-[#8db5ff]">
                            QR do caixa (autoatendimento rapido)
                          </p>
                        )}

                        <img src={qrUrl} alt={`QR Mesa ${tableId}`} className="mx-auto mt-3 h-28 w-28 rounded-lg bg-white p-1" />

                        <p className="mt-3 text-xs text-[#9bb0d0]">Link: {orderLink}</p>
                        {isCashierQuickTable && (
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(orderLink);
                                setFormNotice("Link da mesa 11 copiado para divulgar no Instagram.");
                              } catch {
                                setError("Nao foi possivel copiar o link da mesa 11.");
                              }
                            }}
                            className="mt-2 w-full rounded-lg border border-[#2e476f] bg-[#13233f] px-2 py-2 text-xs font-bold text-[#8db5ff]"
                          >
                            Copiar link rapido (Mesa 11)
                          </button>
                        )}
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
                <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {orders.length === 0 && <p className="text-sm text-[#93a8c6]">Sem pedidos no momento.</p>}
                  {orders.map((order) => {
                    const tableId = getOrderTableId(order);
                    return (
                      <article key={order.id} className="rounded-xl border border-[#2b4062] bg-[#101d33] p-3">
                        <p className="text-lg font-bold text-[#eef4ff]">Mesa {tableId}</p>
                        <p className="text-xs text-[#93a8c6]">{new Date(order.createdAt).toLocaleTimeString("pt-BR")}</p>
                        <ul className="mt-2 space-y-1 text-sm text-[#d6e3f8]">
                          {order.items.map((item) => (
                            <li key={`${order.id}-${item.itemId}`}>
                              {item.quantity}x {item.name}
                            </li>
                          ))}
                        </ul>
                        {order.notes && <p className="mt-2 text-xs italic text-[#93a8c6]">Obs: {order.notes}</p>}
                        <p className="mt-3 text-sm font-bold text-[#ff8c98]">{currency(order.total)}</p>
                        <p className="mt-1 text-xs text-[#8db5ff]">Status: {statusLabel(order.status)}</p>
                      </article>
                    );
                  })}
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

            {activeSection === "profile" && (
              <section className="grid gap-4 xl:grid-cols-[minmax(0,520px)_1fr]">
                <div className="rounded-2xl border border-[#234062] bg-[#0b1424] p-5 shadow-[0_10px_24px_rgba(0,0,0,0.35)]">
                  <h2 className="text-2xl text-white">Perfil do admin</h2>
                  <p className="mt-2 text-sm text-[#b2c5e2]">
                    Atualize o usuario e a senha do painel administrativo sem depender do arquivo de ambiente.
                  </p>

                  <div className="mt-5 space-y-3">
                    <input
                      value={adminUser}
                      onChange={(e) => setAdminUser(e.target.value)}
                      placeholder="Usuario do admin"
                      className="w-full rounded-xl border border-[#2f466d] bg-[#091426] px-4 py-3 text-[#eef4ff]"
                    />
                    <input
                      type="password"
                      value={adminCurrentPassword}
                      onChange={(e) => setAdminCurrentPassword(e.target.value)}
                      placeholder="Senha atual"
                      className="w-full rounded-xl border border-[#2f466d] bg-[#091426] px-4 py-3 text-[#eef4ff]"
                    />
                    <input
                      type="password"
                      value={adminNewPassword}
                      onChange={(e) => setAdminNewPassword(e.target.value)}
                      placeholder="Nova senha"
                      className="w-full rounded-xl border border-[#2f466d] bg-[#091426] px-4 py-3 text-[#eef4ff]"
                    />
                    <input
                      type="password"
                      value={adminConfirmPassword}
                      onChange={(e) => setAdminConfirmPassword(e.target.value)}
                      placeholder="Confirmar nova senha"
                      className="w-full rounded-xl border border-[#2f466d] bg-[#091426] px-4 py-3 text-[#eef4ff]"
                    />

                    <button
                      type="button"
                      onClick={saveAdminProfile}
                      className="w-full rounded-xl bg-gradient-to-r from-[#c81f2f] to-[#0f5bd4] px-4 py-3 font-bold text-white"
                    >
                      Salvar perfil
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#234062] bg-[#0b1424] p-5 shadow-[0_10px_24px_rgba(0,0,0,0.35)]">
                  <h2 className="text-2xl text-white">Regras</h2>
                  <div className="mt-4 space-y-3 text-sm text-[#b2c5e2]">
                    <p>A senha atual e obrigatoria para confirmar a troca.</p>
                    <p>A nova senha passa a valer no proximo login do painel administrativo.</p>
                    <p>O cookie da sessao atual continua valido ate voce sair do painel.</p>
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

      {receiptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-2xl border border-[#365682] bg-[#0b1424] p-6 mx-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-2xl font-bold text-white">Cupom fiscal - Mesa {receiptModal.tableId}</h3>
                <p className="mt-1 text-sm text-[#b2c5e2]">Confira os itens consumidos antes de imprimir.</p>
              </div>
              {isDesktopPrintEnabled && (
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#8db5ff]">
                  Atalho reimpressao: Ctrl+P
                </p>
              )}
            </div>

            <div className="mt-4 rounded-xl border border-[#2f466d] bg-[#091426] p-4 text-sm text-[#dbe7fb]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold">Padaria Solar Supermercado</p>
                <p>CNPJ: 13.487.922/0001-17</p>
              </div>
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-[#9bb0d0]">
                <span>Mesa: {receiptModal.tableId}</span>
                <span>Pagamento: {paymentMethodLabel(receiptModal.method)}</span>
                <span>Data: {new Date(receiptModal.closedAt).toLocaleString("pt-BR")}</span>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#2b4062] text-left text-[#8db5ff]">
                      <th className="px-2 py-2">QTD</th>
                      <th className="px-2 py-2">Descricao</th>
                      <th className="px-2 py-2 text-right">Valor un.</th>
                      <th className="px-2 py-2 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receiptModal.lines.map((line) => (
                      <tr key={`${line.description}-${line.unitPrice}`} className="border-b border-[#1c2f4a] text-[#d6e3f8]">
                        <td className="px-2 py-2">{line.quantity}</td>
                        <td className="px-2 py-2">{line.description}</td>
                        <td className="px-2 py-2 text-right">{currency(line.unitPrice)}</td>
                        <td className="px-2 py-2 text-right font-bold">{currency(line.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-[#9bb0d0]">Pedidos fechados: {receiptModal.orderCount}</p>
                <p className="text-lg font-black text-[#ff8c98]">TOTAL: {currency(receiptModal.total)}</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {isDesktopPrintEnabled && (
                <>
                  <button
                    type="button"
                    onClick={() => void handlePrintReceipt(receiptModal)}
                    disabled={isPrinting}
                    className="rounded-lg bg-[#0f5bd4] px-4 py-3 font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isPrinting && <span className="inline-block animate-spin">⏳</span>}
                    {isPrinting ? "Imprimindo..." : "Imprimir cupom"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleReprintLastReceipt()}
                    disabled={isPrinting}
                    className="rounded-lg border border-[#365682] bg-[#13233f] px-4 py-3 font-bold text-[#d9e7ff] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isPrinting && <span className="inline-block animate-spin">⏳</span>}
                    {isPrinting ? "Reimprimindo..." : "Reimprimir ultimo (Ctrl+P)"}
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setReceiptModal(null)}
                disabled={isPrinting}
                className="rounded-lg border border-[#365682] bg-[#13233f] px-4 py-3 font-bold text-[#d9e7ff] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Fechar
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

      {deleteCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="rounded-2xl border border-[#c81f2f] bg-[#0b1424] p-6 max-w-sm w-full mx-4">
            <h3 className="text-2xl font-bold text-white mb-2">🗑️ Remover categoria</h3>
            <p className="text-sm text-[#b2c5e2] mb-4">
              Categoria: <strong>{deleteCategoryName}</strong>. Digite a senha 1234 para confirmar.
            </p>

            <input
              type="password"
              value={deleteCategoryPassword}
              onChange={(e) => setDeleteCategoryPassword(e.target.value)}
              placeholder="Digite 1234..."
              className="w-full rounded-xl border border-[#2f466d] bg-[#091426] px-4 py-3 text-[#eef4ff] mb-4"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  confirmDeleteMenuCategory();
                }
              }}
            />

            {error && <p className="mb-3 text-xs font-semibold text-[#ff8c98]">{error}</p>}

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setDeleteCategoryModalOpen(false);
                  setDeleteCategoryName("");
                  setDeleteCategoryPassword("");
                  setError("");
                }}
                className="flex-1 rounded-lg border border-[#365682] bg-[#13233f] px-4 py-3 font-bold text-[#d9e7ff] hover:bg-[#1a2f50] transition"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteMenuCategory}
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
