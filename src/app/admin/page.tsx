"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Addon,
  MenuCategory,
  MenuItem,
  Order,
  OrderStatus,
  UnitMeasure,
} from "@/lib/types";

const statusFlow: OrderStatus[] = ["novo", "preparando", "pronto", "entregue"];

type AdminSection = "dashboard" | "menu" | "cardapio" | "tables" | "orders" | "profile";
type TableSummary = {
  tableId: string;
  count: number;
  orders: Order[];
};

type ProductDraft = {
  name: string;
  description: string;
  price: string;
  category: MenuCategory;
  unit: UnitMeasure;
  imageUrl: string;
  addonsList: Addon[];
};

type ExtractedProduct = {
  id: string;
  selected: boolean;
  showInVitrine: boolean;
  name: string;
  description: string;
  price: string;
  unit: string;
  category: string;
  imageUrl: string;
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
  const [tableSummaries, setTableSummaries] = useState<TableSummary[]>([]);
  const [showKitchenAuthEditor, setShowKitchenAuthEditor] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
  const [orderStatusFilter, setOrderStatusFilter] = useState<OrderStatus | "">("");
  const [orderTableFilter, setOrderTableFilter] = useState("");
  const [menuTab, setMenuTab] = useState<"categorias" | "produto" | "pdf" | "lista">("lista");
  const [cardapioTab, setCardapioTab] = useState<"qrcode" | "vitrine">("qrcode");

  const imageFileRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const replaceProductImageRef = useRef<HTMLInputElement>(null);

  const [pdfProcessing, setPdfProcessing] = useState(false);
  const [extractedProducts, setExtractedProducts] = useState<ExtractedProduct[]>([]);
  const [importingProducts, setImportingProducts] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ success: number; error: number; details?: string[] } | null>(null);
  const [importDefaultCategory, setImportDefaultCategory] = useState("");
  const [importDefaultUnit, setImportDefaultUnit] = useState("un");
  const [replacingImageProductId, setReplacingImageProductId] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [currentImportIdx, setCurrentImportIdx] = useState(0);

  async function loadData() {
    const [menuRes, ordersRes, categoriesRes, bakerRes, adminRes, tablesRes] = await Promise.all([
      fetch("/api/menu", { cache: "no-store" }),
      fetch("/api/orders", { cache: "no-store" }),
      fetch("/api/categories", { cache: "no-store" }),
      fetch("/api/baker/credentials", { cache: "no-store" }),
      fetch("/api/admin/profile", { cache: "no-store" }),
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
    function onWindowPaste(ev: ClipboardEvent) {
      if (!(activeSection === "menu" && menuTab === "pdf" && extractedProducts.length === 0)) return;
      const target = ev.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      const files = Array.from(ev.clipboardData?.files || []);
      const picked = files.find((f) => isSupportedImportFile(f));
      if (picked) {
        ev.preventDefault();
        void processImportFile(picked);
        return;
      }

      const text = ev.clipboardData?.getData("text/plain") || "";
      const products = parseClipboardTable(text);
      if (products.length > 0) {
        ev.preventDefault();
        openReviewWithSmartImageStart(products, "texto colado");
      }
    }

    window.addEventListener("paste", onWindowPaste);
    return () => window.removeEventListener("paste", onWindowPaste);
  }, [activeSection, menuTab, extractedProducts.length]);

  const todayOrders = useMemo(() => {
    const todayStr = new Date().toLocaleDateString("pt-BR");
    return orders.filter(
      (order) => new Date(order.createdAt).toLocaleDateString("pt-BR") === todayStr,
    );
  }, [orders]);

  const dashboardMetrics = useMemo(() => {
    return {
      totalProducts: menu.length,
      activeTables: tableSummaries.length,
      openOrders: todayOrders.filter((order) => order.status !== "entregue").length,
    };
  }, [menu.length, todayOrders, tableSummaries.length]);

  const selectedTableSummary = useMemo(() => {
    if (!selectedTableId) return null;
    return tableSummaries.find((table) => table.tableId === selectedTableId) || null;
  }, [selectedTableId, tableSummaries]);

  const quickSelfServiceOrders = useMemo(() => {
    return todayOrders.filter((order) => getOrderTableId(order) === "11");
  }, [todayOrders]);

  const selectedTableOrders = useMemo(() => {
    if (!selectedTableId) return [];
    if (selectedTableId === "11") {
      return quickSelfServiceOrders;
    }
    return selectedTableSummary?.orders || [];
  }, [selectedTableId, selectedTableSummary, quickSelfServiceOrders]);

  const filteredOrders = useMemo(() => {
    return todayOrders.filter((order) => {
      const matchesStatus = orderStatusFilter === "" || order.status === orderStatusFilter;
      const tableId = getOrderTableId(order);
      const matchesTable = orderTableFilter === "" || tableId === orderTableFilter;
      return matchesStatus && matchesTable;
    });
  }, [todayOrders, orderStatusFilter, orderTableFilter]);

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
        if (file) convertImageToDataUrl(file);
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

  async function handleReplaceProductImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !replacingImageProductId) return;

    try {
      const result = await fileToDataUrlWithoutBackground(file);
      setExtractedProducts((prev) =>
        prev.map((p) => (p.id === replacingImageProductId ? { ...p, imageUrl: result } : p)),
      );
    } finally {
      setReplacingImageProductId(null);
    }

    if (replaceProductImageRef.current) replaceProductImageRef.current.value = "";
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      convertImageToDataUrl(file);
    }
    if (imageFileRef.current) imageFileRef.current.value = "";
  }

  function isSupportedImportFile(file: File) {
    const name = file.name.toLowerCase();
    return (
      name.endsWith(".pdf") ||
      name.endsWith(".xlsx") ||
      name.endsWith(".xls") ||
      name.endsWith(".docx") ||
      name.endsWith(".pptx") ||
      name.endsWith(".doc") ||
      name.endsWith(".ppt")
    );
  }

  function parsePriceToString(value: unknown): string {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value > 0 ? value.toFixed(2) : "0";
    }
    const raw = String(value ?? "").trim();
    if (!raw) return "0";

    const compact = raw
      .replace(/\s|\u00A0/g, "")
      .replace(/R\$/gi, "")
      .replace(/[^\d,.-]/g, "");
    if (!compact) return "0";

    const hasComma = compact.includes(",");
    const hasDot = compact.includes(".");

    let normalized = compact;

    if (hasComma && hasDot) {
      // Use the last separator as decimal and remove the other as thousands.
      const lastComma = compact.lastIndexOf(",");
      const lastDot = compact.lastIndexOf(".");
      if (lastComma > lastDot) {
        normalized = compact.replace(/\./g, "").replace(",", ".");
      } else {
        normalized = compact.replace(/,/g, "");
      }
    } else if (hasComma) {
      normalized = /,\d{1,2}$/.test(compact)
        ? compact.replace(/\./g, "").replace(",", ".")
        : compact.replace(/,/g, "");
    } else if (hasDot) {
      normalized = /\.\d{1,2}$/.test(compact)
        ? compact.replace(/,/g, "")
        : compact.replace(/\./g, "");
    }

    const only = normalized.match(/-?\d+(?:\.\d+)?/);
    const parsed = only ? Number(only[0]) : Number.NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed.toFixed(2) : "0";
  }

  function normalizeText(value: string): string {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function splitUnitFromName(name: string, fallbackUnit: string) {
    const raw = name.trim().replace(/\s+/g, " ");
    const match = raw.match(/\b(kg|quilo|g|gr|grama|gramas|un|und|unid|unidade|l|lt|litro|ml)\.?$/i);
    if (!match) {
      return { cleanedName: raw, unit: fallbackUnit };
    }

    const unitToken = normalizeText(match[1]);
    let unit: string = fallbackUnit;
    if (unitToken === "kg" || unitToken === "quilo") unit = "kg";
    else if (unitToken === "g" || unitToken === "gr" || unitToken === "grama" || unitToken === "gramas") unit = "g";
    else if (unitToken === "l" || unitToken === "lt" || unitToken === "litro") unit = "l";
    else if (unitToken === "ml") unit = "ml";
    else unit = "un";

    const cleanedName = raw.slice(0, match.index).trim().replace(/[\-_/]+$/, "").trim();
    return { cleanedName: cleanedName || raw, unit };
  }

  function detectTableHeaderRow(rows: string[][]) {
    let bestIndex = -1;
    let bestScore = -1;

    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      const row = rows[i].map((c) => normalizeText(c));
      if (row.every((c) => !c)) continue;

      const hasProduct = row.some((c) => c.includes("produto") || c.includes("nome") || c === "item");
      const hasPrice = row.some((c) => c.includes("preco") || c.includes("valor") || c === "price");
      const hasCode = row.some((c) => c.includes("codigo") || c.includes("cod"));
      const hasUnit = row.some((c) => c.includes("unidade") || c.includes("unit"));

      let score = 0;
      if (hasProduct) score += 3;
      if (hasPrice) score += 3;
      if (hasCode) score += 1;
      if (hasUnit) score += 1;

      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    return bestScore >= 3 ? bestIndex : -1;
  }

  function isPriceLike(value: string): boolean {
    const v = value.trim();
    if (!v) return false;
    if (/r\$\s*\d+/i.test(v)) return true;
    if (/^\d+[.,]\d{2}$/.test(v)) return true;
    if (/^\d{1,3}(?:\.\d{3})*,\d{2}$/.test(v)) return true;
    return false;
  }

  function isCodeLike(value: string): boolean {
    const v = value.trim();
    if (!v) return false;
    // Typical SKU/code: integer with 3-8 digits, no decimal separators.
    return /^\d{3,8}$/.test(v);
  }

  function hasLetters(value: string): boolean {
    return /[A-Za-zÀ-ÿ]/.test(value);
  }

  function isHeaderLikeCell(value: string): boolean {
    const n = normalizeText(value);
    return (
      n.includes("produto") ||
      n.includes("codigo") ||
      n.includes("preco") ||
      n.includes("valor") ||
      n.includes("descricao") ||
      n.includes("item")
    );
  }

  function inferTableColumns(
    rows: string[][],
    startIndex: number,
    header: string[],
  ): {
    nameCol: number;
    priceCol: number;
    codeCol: number;
    descCol: number;
  } {
    const maxCols = rows.reduce((m, r) => Math.max(m, r.length), 0);
    const stats = Array.from({ length: maxCols }, () => ({ text: 0, price: 0, code: 0, filled: 0 }));

    const end = Math.min(rows.length, startIndex + 150);
    for (let i = startIndex; i < end; i++) {
      const row = rows[i];
      for (let c = 0; c < maxCols; c++) {
        const cell = (row[c] || "").trim();
        if (!cell) continue;
        stats[c].filled += 1;
        if (hasLetters(cell)) stats[c].text += 1;
        if (isPriceLike(cell)) stats[c].price += 1;
        if (isCodeLike(cell)) stats[c].code += 1;
      }
    }

    const headerName = header.findIndex((h) => h.includes("produto") || h.includes("nome") || h.includes("item"));
    const headerDesc = header.findIndex((h) => h.includes("descr"));
    const headerPrice = header.findIndex((h) => h.includes("pre") || h.includes("valor") || h.includes("price"));
    const headerCode = header.findIndex((h) => h.includes("codigo") || h.includes("cod"));

    const bestBy = (kind: "text" | "price" | "code", avoid: number[] = []) => {
      let idx = -1;
      let score = -1;
      for (let c = 0; c < maxCols; c++) {
        if (avoid.includes(c)) continue;
        const current = stats[c][kind];
        if (current > score) {
          score = current;
          idx = c;
        }
      }
      return idx;
    };

    const codeCol = headerCode >= 0 ? headerCode : bestBy("code");
    let priceCol = headerPrice >= 0 ? headerPrice : bestBy("price", codeCol >= 0 ? [codeCol] : []);
    if (priceCol < 0 && codeCol >= 0) {
      // Common layout: [produto, codigo, preco].
      priceCol = codeCol + 1 < maxCols ? codeCol + 1 : -1;
    }

    const avoidForName = [priceCol, codeCol].filter((v) => v >= 0);
    const nameCol = headerName >= 0 ? headerName : bestBy("text", avoidForName);
    const descCol = headerDesc >= 0 ? headerDesc : -1;

    return {
      nameCol: nameCol >= 0 ? nameCol : 0,
      priceCol,
      codeCol,
      descCol,
    };
  }

  function parseClipboardTable(text: string): ExtractedProduct[] {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return [];

    const rows = lines.map((line) => {
      if (line.includes("\t")) return line.split("\t").map((c) => c.trim());
      if (line.includes(";")) return line.split(";").map((c) => c.trim());
      return [line.trim()];
    });

    const { defaultCat, defaultUnit } = getImportDefaults();
    const headerIndex = detectTableHeaderRow(rows);
    const header = (headerIndex >= 0 ? rows[headerIndex] : rows[0]).map((h) => normalizeText(h));
    const hasHeader = headerIndex >= 0;

    const products: ExtractedProduct[] = [];
    const startIndex = hasHeader ? headerIndex + 1 : 0;
    const { nameCol, priceCol, descCol } = inferTableColumns(rows, startIndex, header);
    for (let i = startIndex; i < rows.length; i++) {
      const row = rows[i];
      if (row.every((c) => !c)) continue;

      // Skip repeated headers inside the selection.
      if (row.some((c) => isHeaderLikeCell(c))) continue;

      let rawName = row[nameCol] || "";
      if (!rawName) {
        rawName = row.find((c) => hasLetters(c) && !isHeaderLikeCell(c)) || "";
      }
      const { cleanedName, unit } = splitUnitFromName(rawName, defaultUnit);
      const desc = descCol >= 0 ? (row[descCol] || "") : "";
      const guessedPrice = row.find((c) => isPriceLike(c)) || "";
      const price = parsePriceToString(priceCol >= 0 ? (row[priceCol] || guessedPrice) : guessedPrice);

      if (!cleanedName && !desc && price === "0") continue;

      products.push({
        id: crypto.randomUUID(),
        selected: true,
        showInVitrine: false,
        name: cleanedName || `Produto ${products.length + 1}`,
        description: (desc || cleanedName || "Produto importado").slice(0, 240),
        price,
        unit,
        category: defaultCat,
        imageUrl: "",
      });
    }

    return products;
  }

  async function loadScriptGlobal<T = unknown>(
    globalKey: string,
    scriptUrl: string,
    onLoad?: (w: Window & typeof globalThis) => void,
  ): Promise<T> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (w[globalKey]) return w[globalKey] as T;

    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = scriptUrl;
      script.async = true;
      script.onload = () => {
        if (onLoad) onLoad(window);
        resolve();
      };
      script.onerror = () => reject(new Error("Falha ao carregar biblioteca externa."));
      document.head.appendChild(script);
    });

    if (!w[globalKey]) {
      throw new Error("Biblioteca carregada, mas não foi inicializada corretamente.");
    }
    return w[globalKey] as T;
  }

  function getImportDefaults() {
    return {
      defaultCat: importDefaultCategory || categories[0] || "Salgado",
      defaultUnit: importDefaultUnit || "un",
    };
  }

  function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number) {
    const dr = r1 - r2;
    const dg = g1 - g2;
    const db = b1 - b2;
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }

  async function removeImageBackgroundDataUrl(dataUrl: string): Promise<string> {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Falha ao carregar imagem para remover fundo."));
      image.src = dataUrl;
    });

    const maxSide = 1000;
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;

    ctx.drawImage(img, 0, 0, width, height);
    const imgData = ctx.getImageData(0, 0, width, height);
    const pixels = imgData.data;

    // Estimate background from image borders and remove only connected backdrop pixels.
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let sampleCount = 0;
    const sampleStep = Math.max(1, Math.floor(Math.min(width, height) / 80));

    const addSample = (x: number, y: number) => {
      const idx = (y * width + x) * 4;
      sumR += pixels[idx];
      sumG += pixels[idx + 1];
      sumB += pixels[idx + 2];
      sampleCount += 1;
    };

    for (let x = 0; x < width; x += sampleStep) {
      addSample(x, 0);
      addSample(x, height - 1);
    }
    for (let y = 0; y < height; y += sampleStep) {
      addSample(0, y);
      addSample(width - 1, y);
    }

    if (sampleCount === 0) return dataUrl;

    const bgR = Math.round(sumR / sampleCount);
    const bgG = Math.round(sumG / sampleCount);
    const bgB = Math.round(sumB / sampleCount);
    const bgIsBright = bgR + bgG + bgB > 660;
    const threshold = bgIsBright ? 62 : 48;

    const visited = new Uint8Array(width * height);
    const queueX = new Int32Array(width * height);
    const queueY = new Int32Array(width * height);
    let qHead = 0;
    let qTail = 0;

    const canRemove = (x: number, y: number) => {
      const i = (y * width + x) * 4;
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const a = pixels[i + 3];
      if (a === 0) return true;

      const nearEstimatedBg = colorDistance(r, g, b, bgR, bgG, bgB) <= threshold;
      const nearWhite = r > 228 && g > 228 && b > 228;
      return nearEstimatedBg || (bgIsBright && nearWhite);
    };

    const enqueue = (x: number, y: number) => {
      const p = y * width + x;
      if (visited[p]) return;
      if (!canRemove(x, y)) return;
      visited[p] = 1;
      queueX[qTail] = x;
      queueY[qTail] = y;
      qTail += 1;
    };

    for (let x = 0; x < width; x++) {
      enqueue(x, 0);
      enqueue(x, height - 1);
    }
    for (let y = 0; y < height; y++) {
      enqueue(0, y);
      enqueue(width - 1, y);
    }

    while (qHead < qTail) {
      const x = queueX[qHead];
      const y = queueY[qHead];
      qHead += 1;

      const idx = (y * width + x) * 4;
      pixels[idx + 3] = 0;

      if (x > 0) enqueue(x - 1, y);
      if (x + 1 < width) enqueue(x + 1, y);
      if (y > 0) enqueue(x, y - 1);
      if (y + 1 < height) enqueue(x, y + 1);
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas.toDataURL("image/png");
  }

  async function fileToDataUrlWithoutBackground(file: File): Promise<string> {
    const raw = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string) || "");
      reader.onerror = () => reject(new Error("Falha ao ler arquivo de imagem."));
      reader.readAsDataURL(file);
    });

    if (!raw) return "";
    try {
      return await removeImageBackgroundDataUrl(raw);
    } catch {
      return raw;
    }
  }

  function productsFromTextLines(lines: string[], sourceName: string): ExtractedProduct[] {
    const cleaned = lines.map((l) => l.trim()).filter(Boolean);
    const { defaultCat, defaultUnit } = getImportDefaults();
    const priceRe = /R\$\s*([\d]{1,3}(?:[.][\d]{3})*)[,]([\d]{2})|([\d]+(?:[.,][\d]{2}))/;
    const skipRe = /^[-_=•·*]{2,}$|^\d+$/i;

    let buf = { name: "", desc: "" };
    const out: ExtractedProduct[] = [];

    for (const line of cleaned) {
      if (skipRe.test(line)) continue;
      const m = line.match(priceRe);
      if (m) {
        const price = m[1] && m[2] ? `${m[1].replace(/\./g, "")}.${m[2]}` : parsePriceToString(m[3] || "0");
        if (buf.name) {
          out.push({
            id: crypto.randomUUID(),
            selected: true,
            showInVitrine: false,
            name: buf.name,
            description: (buf.desc || buf.name).slice(0, 240),
            price,
            unit: defaultUnit,
            category: defaultCat,
            imageUrl: "",
          });
        }
        buf = { name: "", desc: "" };
      } else if (!buf.name) {
        buf.name = line;
      } else if (!buf.desc) {
        buf.desc = line;
      } else {
        buf.desc = `${buf.desc} ${line}`.slice(0, 320);
      }
    }

    if (buf.name) {
      out.push({
        id: crypto.randomUUID(),
        selected: true,
        showInVitrine: false,
        name: buf.name,
        description: (buf.desc || buf.name).slice(0, 240),
        price: "0",
        unit: defaultUnit,
        category: defaultCat,
        imageUrl: "",
      });
    }

    if (out.length === 0 && cleaned.length > 0) {
      const merged = cleaned.join(" ").slice(0, 220);
      out.push({
        id: crypto.randomUUID(),
        selected: true,
        showInVitrine: false,
        name: sourceName.replace(/\.[^.]+$/, "") || "Produto importado",
        description: merged || "Produto sem texto reconhecido",
        price: "0",
        unit: defaultUnit,
        category: defaultCat,
        imageUrl: "",
      });
    }

    return out;
  }

  async function parseExcelFile(file: File): Promise<ExtractedProduct[]> {
    type XlsxGlobal = {
      read: (data: ArrayBuffer, opts: { type: "array" }) => {
        SheetNames: string[];
        Sheets: Record<string, unknown>;
      };
      utils: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sheet_to_json: (sheet: unknown, opts: { header: 1; defval: string }) => any[][];
      };
    };

    const XLSX = await loadScriptGlobal<XlsxGlobal>(
      "XLSX",
      "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
    );

    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const { defaultCat, defaultUnit } = getImportDefaults();
    const products: ExtractedProduct[] = [];

    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" })
        .map((row) => row.map((c) => String(c ?? "").trim()));
      if (rows.length === 0) continue;

      const headerIndex = detectTableHeaderRow(rows);
      const header = (headerIndex >= 0 ? rows[headerIndex] : rows[0]).map((h) => normalizeText(h));
      const idxCat = header.findIndex((h) => h.includes("categ"));
      const idxUnit = header.findIndex((h) => h.includes("unid") || h.includes("unit"));
      const startsWithHeader = headerIndex >= 0;

      const startIndex = startsWithHeader ? headerIndex + 1 : 0;
      const { nameCol, priceCol, descCol } = inferTableColumns(rows, startIndex, header);
      for (let i = startIndex; i < rows.length; i++) {
        const row = rows[i];
        if (row.every((c) => !c)) continue;

        // Skip repeated headers inside sheet blocks.
        if (row.some((c) => isHeaderLikeCell(c))) continue;

        let rawName = row[nameCol] || "";
        if (!rawName) {
          rawName = row.find((c) => hasLetters(c) && !isHeaderLikeCell(c)) || "";
        }
        const { cleanedName, unit: inferredUnit } = splitUnitFromName(rawName, defaultUnit);
        const description = descCol >= 0 ? (row[descCol] || "") : "";
        const guessedPrice = row.find((c) => isPriceLike(c)) || "";
        const priceRaw = priceCol >= 0 ? (row[priceCol] || guessedPrice) : guessedPrice;
        const price = parsePriceToString(priceRaw);
        const categoryValue = idxCat >= 0 ? (row[idxCat] || "") : "";
        const unitValue = idxUnit >= 0 ? (row[idxUnit] || "") : "";

        if (!cleanedName && !description && price === "0") continue;

        products.push({
          id: crypto.randomUUID(),
          selected: true,
          showInVitrine: false,
          name: cleanedName || `Produto ${products.length + 1}`,
          description: (description || cleanedName || "Produto importado do Excel").slice(0, 240),
          price,
          unit: unitValue || inferredUnit,
          category: categoryValue || defaultCat,
          imageUrl: "",
        });
      }
    }

    return products;
  }

  async function parseWordFile(file: File): Promise<ExtractedProduct[]> {
    type MammothGlobal = {
      extractRawText: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
    };

    const mammoth = await loadScriptGlobal<MammothGlobal>(
      "mammoth",
      "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js",
    );

    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    const lines = result.value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    return productsFromTextLines(lines, file.name);
  }

  function decodeXmlText(text: string) {
    return text
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  async function parsePowerPointFile(file: File): Promise<ExtractedProduct[]> {
    type ZipFileObj = { async: (type: "string") => Promise<string> };
    type JSZipGlobal = {
      loadAsync: (data: ArrayBuffer) => Promise<{ files: Record<string, ZipFileObj | undefined> }>;
    };

    const JSZip = await loadScriptGlobal<JSZipGlobal>(
      "JSZip",
      "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
    );

    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const slidePaths = Object.keys(zip.files)
      .filter((p) => /^ppt\/slides\/slide\d+\.xml$/i.test(p))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const lines: string[] = [];
    for (const path of slidePaths) {
      const xmlFile = zip.files[path];
      if (!xmlFile) continue;
      const xml = await xmlFile.async("string");
      const matches = [...xml.matchAll(/<a:t>(.*?)<\/a:t>/g)];
      for (const m of matches) {
        const text = decodeXmlText(m[1] || "").trim();
        if (text) lines.push(text);
      }
    }

    return productsFromTextLines(lines, file.name);
  }

  function openReviewWithSmartImageStart(products: ExtractedProduct[], sourceLabel: string) {
    if (products.length === 0) {
      setError(`Nenhum conteúdo reconhecido em ${sourceLabel}.`);
      return;
    }

    setExtractedProducts(products);
    const firstWithoutImage = products.findIndex((p) => !p.imageUrl || p.imageUrl.trim().length === 0);
    setCurrentImportIdx(firstWithoutImage >= 0 ? firstWithoutImage : 0);
    setShowImportModal(true);

    const withoutImageCount = products.filter((p) => !p.imageUrl || p.imageUrl.trim().length === 0).length;
    setFormNotice(
      `${products.length} produto(s) extraído(s) de ${sourceLabel}.` +
      (withoutImageCount > 0
        ? ` ${withoutImageCount} sem imagem detectada. A revisão abriu no primeiro item sem imagem.`
        : ""),
    );
  }

  async function processImportFile(file: File) {
    if (!isSupportedImportFile(file)) {
      setError("Formato não suportado. Use PDF, Excel, Word ou PowerPoint.");
      return;
    }

    const lower = file.name.toLowerCase();

    if (lower.endsWith(".pdf")) {
      await processPdf(file);
      return;
    }

    if (lower.endsWith(".doc") || lower.endsWith(".ppt")) {
      setError("Arquivos .doc e .ppt antigos não são suportados diretamente. Salve como .docx/.pptx e tente novamente.");
      return;
    }

    setPdfProcessing(true);
    setExtractedProducts([]);
    setImportResult(null);
    setError("");

    try {
      let products: ExtractedProduct[] = [];
      if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
        products = await parseExcelFile(file);
      } else if (lower.endsWith(".docx")) {
        products = await parseWordFile(file);
      } else if (lower.endsWith(".pptx")) {
        products = await parsePowerPointFile(file);
      }

      openReviewWithSmartImageStart(products, file.name);
    } catch (e) {
      setError("Erro ao processar arquivo: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setPdfProcessing(false);
    }
  }

  async function importFromInputFile(file?: File | null) {
    if (!file) return;
    await processImportFile(file);
  }

  function handleImportDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files || []);
    const target = files.find((f) => isSupportedImportFile(f));
    if (target) {
      void processImportFile(target);
    } else {
      setError("Arquivo não suportado no drop. Use PDF, Excel, Word ou PowerPoint.");
    }
  }

  function handleImportDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleImportPaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const files = Array.from(e.clipboardData.files || []);
    const target = files.find((f) => isSupportedImportFile(f));
    if (target) {
      e.preventDefault();
      void processImportFile(target);
      return;
    }

    const text = e.clipboardData.getData("text/plain");
    const products = parseClipboardTable(text);
    if (products.length > 0) {
      e.preventDefault();
      openReviewWithSmartImageStart(products, "texto colado");
    }
  }

  async function processPdf(file: File) {
    setPdfProcessing(true);
    setExtractedProducts([]);
    setImportResult(null);
    setError("");
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfjsLib: any = await new Promise((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const w = window as any;
        if (w.pdfjsLib) { resolve(w.pdfjsLib); return; }
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
        script.async = true;
        script.onload = () => {
          w.pdfjsLib.GlobalWorkerOptions.workerSrc =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
          resolve(w.pdfjsLib);
        };
        script.onerror = () => reject(new Error("Falha ao carregar biblioteca PDF. Verifique sua conexão."));
        document.head.appendChild(script);
      });

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
      const allProducts: ExtractedProduct[] = [];

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 0.9 });
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = Math.floor(viewport.width);
        pageCanvas.height = Math.floor(viewport.height);
        const pageCtx = pageCanvas.getContext("2d");
        if (pageCtx) await page.render({ canvasContext: pageCtx, viewport }).promise;
        const pageImageFallback = pageCanvas.toDataURL("image/jpeg", 0.6);

        const embeddedImages: string[] = [];
        try {
          const opList = await page.getOperatorList();
          const OPS = pdfjsLib.OPS;
          const seenRefs = new Set<string>();

          for (let i = 0; i < opList.fnArray.length; i++) {
            const fn = opList.fnArray[i];
            if (fn !== OPS.paintImageXObject && fn !== OPS.paintInlineImageXObject) continue;

            const ref = String(opList.argsArray[i][0]);
            if (seenRefs.has(ref)) continue;
            seenRefs.add(ref);

            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const imgData: any = await new Promise((res) => page.objs.get(ref, res));
              if (!imgData?.width || !imgData?.height || !imgData?.data) continue;
              if (imgData.width < 80 || imgData.height < 80) continue;

              const ic = document.createElement("canvas");
              ic.width = imgData.width;
              ic.height = imgData.height;
              const ictx = ic.getContext("2d")!;
              const pixCount = imgData.width * imgData.height;
              const ch = Math.round((imgData.data as Uint8Array).length / pixCount);
              const rgba = new Uint8ClampedArray(pixCount * 4);

              for (let p = 0; p < pixCount; p++) {
                if (ch === 4) {
                  rgba[p * 4] = imgData.data[p * 4];
                  rgba[p * 4 + 1] = imgData.data[p * 4 + 1];
                  rgba[p * 4 + 2] = imgData.data[p * 4 + 2];
                  rgba[p * 4 + 3] = imgData.data[p * 4 + 3];
                } else if (ch === 3) {
                  rgba[p * 4] = imgData.data[p * 3];
                  rgba[p * 4 + 1] = imgData.data[p * 3 + 1];
                  rgba[p * 4 + 2] = imgData.data[p * 3 + 2];
                  rgba[p * 4 + 3] = 255;
                } else {
                  const v = imgData.data[p];
                  rgba[p * 4] = rgba[p * 4 + 1] = rgba[p * 4 + 2] = v;
                  rgba[p * 4 + 3] = 255;
                }
              }

              const id2 = ictx.createImageData(imgData.width, imgData.height);
              id2.data.set(rgba);
              ictx.putImageData(id2, 0, 0);
              const rawImage = ic.toDataURL("image/png");
              const cleanedImage = await removeImageBackgroundDataUrl(rawImage).catch(() => rawImage);
              embeddedImages.push(cleanedImage);
            } catch { }
          }
        } catch { }

        const textContent = await page.getTextContent();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawItems = (textContent.items as any[])
          .filter((i) => typeof i.str === "string" && i.str.trim())
          .map((i) => ({ str: i.str as string, x: i.transform[4] as number, y: i.transform[5] as number }));

        rawItems.sort((a, b) => {
          const dy = b.y - a.y;
          return Math.abs(dy) > 3 ? dy : a.x - b.x;
        });

        const lines: string[] = [];
        let lineY = -9999;
        let parts: string[] = [];
        for (const item of rawItems) {
          if (Math.abs(item.y - lineY) <= 3) {
            parts.push(item.str);
          } else {
            const joined = parts.join(" ").trim();
            if (joined) lines.push(joined);
            parts = [item.str];
            lineY = item.y;
          }
        }
        const lastJoined = parts.join(" ").trim();
        if (lastJoined) lines.push(lastJoined);

        const defaultCat = importDefaultCategory || categories[0] || "Salgado";
        const defaultUnit = importDefaultUnit || "un";

        const priceRe = /R\$\s*([\d]{1,3}(?:[.][\d]{3})*)[,]([\d]{2})/;
        const skipRe = /^[-_=•·*]{2,}$|^\d+$|^página\s*\d+$/i;

        let buf = { name: "", desc: "" };
        const pageProducts: ExtractedProduct[] = [];

        for (const line of lines) {
          if (skipRe.test(line.trim())) continue;

          const m = line.match(priceRe);
          if (m) {
            const price = `${m[1].replace(/\./g, "")}.${m[2]}`;
            if (buf.name) {
              pageProducts.push({
                id: crypto.randomUUID(),
                selected: true,
                showInVitrine: false,
                name: buf.name.trim(),
                description: (buf.desc || buf.name).trim().slice(0, 220),
                price,
                unit: defaultUnit,
                category: defaultCat,
                imageUrl: "",
              });
            }
            buf = { name: "", desc: "" };
          } else if (!buf.name) {
            buf.name = line;
          } else if (!buf.desc) {
            buf.desc = line;
          } else {
            buf.desc = (buf.desc + " " + line).slice(0, 300);
          }
        }
        if (buf.name) {
          pageProducts.push({
            id: crypto.randomUUID(),
            selected: true,
            showInVitrine: false,
            name: buf.name.trim(),
            description: (buf.desc || buf.name).trim().slice(0, 220),
            price: "0",
            unit: defaultUnit,
            category: defaultCat,
            imageUrl: "",
          });
        }

        if (pageProducts.length === 0 && pageImageFallback) {
          allProducts.push({
            id: crypto.randomUUID(),
            selected: true,
            showInVitrine: false,
            name: "",
            description: "",
            price: "0",
            unit: defaultUnit,
            category: defaultCat,
            imageUrl: pageImageFallback,
          });
        }

        for (let pi = 0; pi < pageProducts.length; pi++) {
          if (embeddedImages.length > 0) {
            pageProducts[pi].imageUrl = embeddedImages[Math.min(pi, embeddedImages.length - 1)];
          } else {
            pageProducts[pi].imageUrl = pageImageFallback;
          }
        }

        allProducts.push(...pageProducts);
      }

      if (allProducts.length === 0) {
        setError("Nenhum conteúdo encontrado. Verifique se o PDF tem pelo menos uma página.");
      } else {
        openReviewWithSmartImageStart(allProducts, file.name);
      }
    } catch (e) {
      setError("Erro ao processar PDF: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setPdfProcessing(false);
    }
  }

  async function importProducts() {
    const toImport = extractedProducts.filter((p) => p.selected && p.name.trim());
    if (toImport.length === 0) {
      setError("Nenhum produto selecionado para importar.");
      return;
    }
    setImportingProducts(true);
    setImportProgress(0);
    setImportResult(null);
    setError("");

    const parseImportedPrice = (value: string) => {
      const normalized = String(value || "")
        .replace(/\s/g, "")
        .replace(/R\$/gi, "")
        .replace(/\./g, "")
        .replace(",", ".");
      const num = Number(normalized);
      return Number.isFinite(num) && num > 0 ? num : 0.01;
    };

    type BulkPayloadProduct = {
      name: string;
      description: string;
      price: number;
      category: string;
      unit: string;
      imageUrl: string;
      available: boolean;
    };

    const products: BulkPayloadProduct[] = toImport.map((p) => ({
      name: p.name.trim(),
      description: (p.description || p.name).trim(),
      price: parseImportedPrice(p.price),
      category: p.category || categories[0] || "Salgado",
      unit: p.unit || "un",
      imageUrl: p.imageUrl,
      available: p.showInVitrine,
    }));

    const MAX_PRODUCTS_PER_CHUNK = 20;
    const MAX_PAYLOAD_BYTES = 900_000;
    const encoder = new TextEncoder();

    const estimatePayloadBytes = (items: BulkPayloadProduct[]) =>
      encoder.encode(JSON.stringify({ products: items })).length;

    const buildAdaptiveChunks = (items: BulkPayloadProduct[]) => {
      const chunks: BulkPayloadProduct[][] = [];
      let current: BulkPayloadProduct[] = [];

      for (const item of items) {
        if (current.length === 0) {
          current = [item];
          continue;
        }

        const candidate = [...current, item];
        const exceedsLimit =
          candidate.length > MAX_PRODUCTS_PER_CHUNK || estimatePayloadBytes(candidate) > MAX_PAYLOAD_BYTES;

        if (exceedsLimit) {
          chunks.push(current);
          current = [item];
        } else {
          current = candidate;
        }
      }

      if (current.length > 0) chunks.push(current);
      return chunks;
    };

    const chunks = buildAdaptiveChunks(products);

    let totalSuccess = 0;
    let totalErrors = 0;
    const errorDetails: string[] = [];
    let processedCount = 0;

    const updateProgressBy = (count: number) => {
      processedCount += count;
      setImportProgress(Math.round((processedCount / products.length) * 100));
    };

    const extractErrorMessage = async (res: Response) => {
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      return payload.error || `Erro HTTP ${res.status}`;
    };

    const saveChunkWithFallback = async (chunk: BulkPayloadProduct[]): Promise<void> => {
      try {
        const res = await fetch("/api/menu/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ products: chunk }),
        });

        if (res.status === 401) {
          throw new Error("Sessão expirada no admin. Faça login novamente e tente importar.");
        }

        if (!res.ok) {
          if (chunk.length > 1) {
            const middle = Math.ceil(chunk.length / 2);
            await saveChunkWithFallback(chunk.slice(0, middle));
            await saveChunkWithFallback(chunk.slice(middle));
            return;
          }

          const message = await extractErrorMessage(res);
          totalErrors += 1;
          errorDetails.push(`${chunk[0].name}: ${message}`);
          updateProgressBy(1);
          return;
        }

        const data = (await res.json()) as {
          success: number;
          errors: number;
          results?: { name: string; ok: boolean; error?: string }[];
        };

        totalSuccess += data.success;
        totalErrors += data.errors;

        for (const row of data.results || []) {
          if (!row.ok && row.error) {
            errorDetails.push(`${row.name}: ${row.error}`);
          }
        }

        updateProgressBy(chunk.length);
      } catch (e) {
        if (chunk.length > 1) {
          const middle = Math.ceil(chunk.length / 2);
          await saveChunkWithFallback(chunk.slice(0, middle));
          await saveChunkWithFallback(chunk.slice(middle));
          return;
        }

        totalErrors += 1;
        errorDetails.push(`${chunk[0].name}: ${e instanceof Error ? e.message : String(e)}`);
        updateProgressBy(1);
      }
    };

    try {
      for (let i = 0; i < chunks.length; i++) {
        await saveChunkWithFallback(chunks[i]);
      }

      setImportProgress(100);

      setImportResult({
        success: totalSuccess,
        error: totalErrors,
        details: errorDetails.slice(0, 5),
      });

      if (totalErrors > 0) {
        const preview = errorDetails.slice(0, 3).join(" | ");
        setError(`Alguns itens não foram salvos. ${preview}${errorDetails.length > 3 ? " ..." : ""}`);
      }

      if (totalSuccess > 0) loadData();
    } catch (e) {
      setError("Erro de conexão: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setImportingProducts(false);
    }
  }

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
      body: JSON.stringify({ name, description, price: Number(price), category, unit, imageUrl, available: true, addons: addonsList }),
    });

    if (!res.ok) {
      setError("Nao foi possivel cadastrar item.");
      return;
    }

    setName(""); setDescription(""); setPrice(""); setUnit("un"); setImageUrl(""); setAddonsList([]);
    setNewAddonName(""); setNewAddonPrice(""); setNewAddonDesc("");
    setError("");
    setFormNotice("Item cadastrado com sucesso.");
    loadData();
  }

  async function saveBakerCredentials() {
    const u = kitchenUser.trim();
    const p = kitchenPass.trim();
    if (!u || !p) {
      setError("Informe usuario e senha do padeiro para salvar.");
      return;
    }
    const res = await fetch("/api/baker/credentials", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: u, password: p }),
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
    const u = adminUser.trim();
    const current = adminCurrentPassword.trim();
    const next = adminNewPassword.trim();
    const confirm = adminConfirmPassword.trim();

    if (!u || !current || !next || !confirm) {
      setError("Preencha usuario, senha atual, nova senha e confirmacao.");
      return;
    }
    if (next !== confirm) {
      setError("A confirmacao da nova senha nao confere.");
      return;
    }

    const res = await fetch("/api/admin/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: u, currentPassword: current, newPassword: next }),
    });

    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      setError(payload.error || "Nao foi possivel atualizar o perfil do admin.");
      return;
    }

    const data = (await res.json()) as { username: string };
    setAdminUser(data.username || u);
    setAdminCurrentPassword(""); setAdminNewPassword(""); setAdminConfirmPassword("");
    setError("");
    setFormNotice("Perfil do admin atualizado com sucesso.");
  }

  async function addMenuCategory() {
    const n = newCategoryName.trim();
    if (!n) {
      setError("Informe o nome da categoria para adicionar.");
      return;
    }
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: n }),
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
    setCategory(n as MenuCategory);
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
    const n = deleteCategoryName.trim();
    const res = await fetch("/api/categories", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: n }),
    });
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      setError(payload.error || "Nao foi possivel remover categoria.");
      return;
    }
    setError("");
    setFormNotice(`Categoria ${n} removida com sucesso.`);
    setDeleteCategoryModalOpen(false);
    setDeleteCategoryName("");
    setDeleteCategoryPassword("");
    await loadData();
    if (category === n) setCategory("Salgado");
    if (searchCategory === n) setSearchCategory("");
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
    setMenuTab("produto");
    setActiveSection("menu");
    setFormNotice(`Editando: ${item.name}`);
  }

  async function updateItem() {
    if (!editingItemId) return;
    const res = await fetch(`/api/menu/${editingItemId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, price: Number(price), category, unit, imageUrl, available: true, addons: addonsList }),
    });
    if (!res.ok) {
      setError("Nao foi possivel atualizar item.");
      return;
    }
    setName(""); setDescription(""); setPrice(""); setUnit("un"); setImageUrl(""); setAddonsList([]);
    setNewAddonName(""); setNewAddonPrice(""); setNewAddonDesc("");
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

  async function releaseTable(tableId: string) {
    const res = await fetch("/api/tables/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableId }),
    });
    if (!res.ok) {
      setError("Nao foi possivel liberar a mesa.");
      return;
    }
    setError("");
    setFormNotice(`Mesa ${tableId} liberada com sucesso.`);
    loadData();
  }

  async function advanceOrderStatus(orderId: string, currentStatus: OrderStatus) {
    const currentIndex = statusFlow.indexOf(currentStatus);
    if (currentIndex === statusFlow.length - 1) return;
    const nextStatus = statusFlow[currentIndex + 1];
    await fetch(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
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
          style={{ backgroundImage: "url('/images/capa-solar-supermercado.jpg')" }}
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
        <div className="border-b border-[#244063] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8db5ff]">Painel Admin</p>
          <h1 className="text-xl font-bold text-white mt-2">Padaria Solar</h1>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {(["dashboard", "menu", "cardapio", "tables", "orders", "profile"] as AdminSection[]).map((section) => {
            const labels: Record<AdminSection, string> = {
              dashboard: "Dashboard",
              menu: "📦 Produtos",
              cardapio: "📱 Cardápio Digital",
              tables: "🪑 Mesas",
              orders: "📋 Pedidos",
              profile: "👤 Perfil",
            };
            return (
              <button
                key={section}
                onClick={() => openSection(section)}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-bold transition ${
                  activeSection === section
                    ? "bg-gradient-to-r from-[#c81f2f] to-[#0f5bd4] text-white"
                    : "text-[#d3e4ff] hover:bg-[#13233f]"
                }`}
              >
                {labels[section]}
              </button>
            );
          })}

          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowKitchenAuthEditor((v) => !v)}
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

        <div className="border-t border-[#244063] p-4 space-y-2">
          <a
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="block w-full text-center px-4 py-2 rounded-lg border border-[#365682] bg-[#13233f] text-xs font-bold text-[#d9e7ff] hover:bg-[#1a2f50] transition"
          >
            🍽️ Cardápio
          </a>
          <a
            href="/kitchen"
            onClick={() => setMobileMenuOpen(false)}
            className="block w-full text-center px-4 py-2 rounded-lg border border-[#c81f2f] bg-[#c81f2f]/10 text-xs font-bold text-[#ff8c98] hover:bg-[#c81f2f]/20 transition"
          >
            👨‍🍳 Cozinha
          </a>
          <button
            onClick={() => { setMobileMenuOpen(false); logout(); }}
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
              {activeSection === "cardapio" && "Cardápio Digital"}
              {activeSection === "profile" && "Perfil do Administrador"}
            </h1>
          </header>

          {/* Feedback messages */}
          {error && (
            <div className="mb-4 rounded-xl border border-[#c81f2f]/40 bg-[#c81f2f]/10 px-4 py-3 text-sm font-semibold text-[#ff8c98]">
              {error}
            </div>
          )}
          {formNotice && (
            <div className="mb-4 rounded-xl border border-[#1f8b4c]/40 bg-[#1f8b4c]/10 px-4 py-3 text-sm font-semibold text-[#8fe0b8]">
              {formNotice}
            </div>
          )}

          <section className="space-y-4">
            {/* ─── DASHBOARD ─── */}
            {activeSection === "dashboard" && (
              <section className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <article className="rounded-2xl border border-[#234062] bg-[#0b1424] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#8db5ff]">Produtos cadastrados</p>
                    <p className="mt-2 text-3xl font-black text-white">{dashboardMetrics.totalProducts}</p>
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
                  <h2 className="text-xl font-bold text-white">Acesso separado da cozinha</h2>
                  <p className="mt-2 text-sm text-[#c2d4ef]">
                    O padeiro usa o link <strong>/kitchen</strong> com login proprio. Esse perfil nao acessa o painel administrativo.
                  </p>
                </div>
              </section>
            )}

            {/* ─── MENU ─── */}
            {activeSection === "menu" && (
              <div className="space-y-3">
                {/* ── Tab bar ── */}
                <div className="overflow-x-auto">
                  <div className="flex min-w-max gap-1.5 rounded-2xl border border-[#234062] bg-[#0b1424] p-1.5">
                    {([
                      { id: "lista",      label: "📋 Produtos",     badge: menu.length },
                      { id: "categorias", label: "📂 Categorias",   badge: categories.length },
                      { id: "produto",    label: editingItemId ? "✏️ Editando" : "➕ Novo produto" },
                      { id: "pdf",        label: "📥 Importar Arquivo" },
                    ] as { id: typeof menuTab; label: string; badge?: number }[]).map(({ id, label, badge }) => (
                      <button key={id} type="button" onClick={() => setMenuTab(id)}
                        className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
                          menuTab === id
                            ? "bg-gradient-to-r from-[#c81f2f] to-[#0f5bd4] text-white shadow-lg"
                            : "text-[#8db5ff] hover:bg-[#13233f]"
                        }`}>
                        {label}{badge !== undefined ? ` (${badge})` : ""}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Aba: Lista de Produtos ── */}
                {menuTab === "lista" && (
                  <section className="rounded-2xl border border-[#234062] bg-[#0b1424] p-4">
                    <div className="mb-4 space-y-2">
                      <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="🔍 Pesquisar por nome ou descrição..." className="w-full rounded-xl border border-[#2f466d] bg-[#091426] px-4 py-3 text-[#eef4ff] placeholder:text-[#7a94b8]" />
                      <div className="flex gap-2">
                        <select value={searchCategory} onChange={(e) => setSearchCategory((e.target.value as MenuCategory) || "")} className="flex-1 rounded-xl border border-[#2f466d] bg-[#091426] px-4 py-2 text-[#eef4ff]">
                          <option value="">Todas as categorias</option>
                          {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                        {(searchQuery || searchCategory) && (
                          <button onClick={() => { setSearchQuery(""); setSearchCategory(""); }} className="rounded-xl border border-[#2f466d] bg-[#13233f] px-4 py-2 text-sm font-bold text-[#d6e3f8]">Limpar</button>
                        )}
                      </div>
                    </div>
                    <p className="mb-3 text-xs text-[#8db5ff]">{filteredMenu.length} produto(s)</p>
                    <div className="grid gap-3 md:grid-cols-2">
                      {filteredMenu.map((item) => (
                        <article key={item.id} className="rounded-2xl border border-[#2a4162] bg-[#101d33] p-3">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-xl leading-none text-white">{item.name}</h3>
                            <span className={`text-xs font-bold uppercase tracking-[0.1em] px-2 py-1 rounded ${item.available ? "bg-[#8fe0b8]/20 text-[#8fe0b8]" : "bg-[#ff8c98]/20 text-[#ff8c98]"}`}>
                              {item.available ? "Vitrine" : "Só catálogo"}
                            </span>
                          </div>
                          <span className="inline-block mt-2 text-xs font-bold uppercase tracking-[0.1em] text-[#8db5ff]">{item.category}</span>
                          <div className="mt-2 overflow-hidden rounded-lg border border-[#2b4062] bg-[#0b1424]">
                            <img src={item.imageUrl} alt={item.name} className="h-24 w-full object-cover" />
                          </div>
                          {item.addons && item.addons.length > 0 && (
                            <p className="mt-2 text-xs text-[#97afcf]">Acompanhamentos: {item.addons.map((a) => a.name).join(", ")}</p>
                          )}
                          <p className="mt-2 text-sm font-bold text-[#8db5ff]">{currency(item.price)}</p>
                          <p className="mt-1 text-xs text-[#8db5ff]">Unidade: {item.unit}</p>
                          <div className="mt-3 flex gap-2 flex-wrap">
                            <button onClick={() => editItem(item)} className="rounded-lg border border-[#0f5bd4] bg-[#0f5bd4]/20 px-3 py-2 text-xs font-bold text-[#0f9fff] hover:bg-[#0f5bd4]/40 transition">✏️ Editar</button>
                            <button onClick={() => toggleAvailability(item)} className="flex-1 rounded-lg border border-[#2e476f] bg-[#13233f] px-2 py-2 text-xs font-bold text-[#d3e4ff] hover:bg-[#1a2f50] transition">
                              {item.available ? "🔒 Remover vitrine" : "🔓 Adicionar vitrine"}
                            </button>
                            <button onClick={() => { setDeleteItemId(item.id); setDeleteModalOpen(true); setDeletePassword(""); }} className="rounded-lg bg-[#c81f2f] px-3 py-2 text-xs font-bold text-white hover:bg-[#b01625] transition">🗑️</button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                )}

                {/* ── Aba: Categorias ── */}
                {menuTab === "categorias" && (
                  <section className="rounded-2xl border border-[#234062] bg-[#0b1424] p-4">
                    <h2 className="text-xl font-bold text-white">Categorias do cardápio</h2>
                    <p className="mt-1 text-xs text-[#9bb0d0]">Adicione ou remova categorias usadas no cadastro de produtos.</p>
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Nova categoria"
                        className="w-full rounded-xl border border-[#2f466d] bg-[#091426] px-3 py-2 text-[#eef4ff]"
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMenuCategory(); } }} />
                      <button type="button" onClick={addMenuCategory} className="rounded-xl bg-[#0f5bd4] px-5 py-2 font-bold text-white">Adicionar</button>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {categories.map((cat) => (
                        <div key={cat} className="flex items-center gap-2 rounded-lg border border-[#2b4062] bg-[#101d33] px-3 py-2">
                          <span className="text-xs font-bold uppercase tracking-[0.06em] text-[#d6e3f8]">{cat}</span>
                          <button type="button" onClick={() => removeMenuCategory(cat)} className="rounded px-2 py-1 text-xs font-bold text-[#ff8c98] hover:bg-[#1a2a3f]">Remover</button>
                        </div>
                      ))}
                      {categories.length === 0 && <p className="text-sm text-[#93a8c6]">Nenhuma categoria cadastrada ainda.</p>}
                    </div>
                  </section>
                )}

                {/* ── Aba: Novo Produto / Editar ── */}
                {menuTab === "produto" && (
                  <form onSubmit={addMenu} className="rounded-2xl border border-[#234062] bg-[#0b1424] p-4">
                    <h2 className="text-2xl text-white">{editingItemId ? "Editar Item" : "Novo Item"}</h2>
                    <div className="mt-4 space-y-2">
                      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" required className="w-full rounded-xl border border-[#2f466d] bg-[#091426] px-3 py-2 text-[#eef4ff]" />
                      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descricao" required className="h-20 w-full resize-none rounded-xl border border-[#2f466d] bg-[#091426] px-3 py-2 text-[#eef4ff]" />
                      <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" min="0" step="0.01" placeholder="Preco (referencia no cardapio)" required className="w-full rounded-xl border border-[#2f466d] bg-[#091426] px-3 py-2 text-[#eef4ff]" />
                      <select value={category} onChange={(e) => setCategory(e.target.value as MenuCategory)} className="w-full rounded-xl border border-[#2f466d] bg-[#091426] px-3 py-2 text-[#eef4ff]">
                        {categories.length > 0 ? categories.map((cat) => <option key={cat}>{cat}</option>) : <><option>Salgado</option><option>Lanche</option><option>Bebida</option><option>Doce</option></>}
                      </select>
                      <select value={unit} onChange={(e) => setUnit(e.target.value as UnitMeasure)} className="w-full rounded-xl border border-[#2f466d] bg-[#091426] px-3 py-2 text-[#eef4ff]">
                        <option value="un">Unidade (un)</option><option value="kg">Quilo (kg)</option><option value="g">Grama (g)</option><option value="l">Litro (l)</option><option value="ml">Mililitro (ml)</option>
                      </select>
                      <div onDrop={handleImageDrop} onDragOver={handleImageDragOver} className="w-full rounded-xl border-2 border-dashed border-[#2f466d] bg-[#091426] px-3 py-4 transition-colors hover:border-[#0f5bd4]">
                        <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} onPaste={handleImagePaste} placeholder="Cole (Ctrl+V) ou arraste a imagem aqui" className="w-full bg-transparent text-[#eef4ff] placeholder-[#7a95bd] outline-none" />
                        <input ref={imageFileRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                        <button type="button" onClick={() => imageFileRef.current?.click()} className="mt-3 w-full rounded-lg border border-[#2f466d] bg-[#13233f] px-3 py-2 text-xs font-bold text-[#8db5ff] hover:bg-[#1a2f50] transition">
                          📁 Selecionar imagem (celular ou computador)
                        </button>
                        {imageUrl && <div className="mt-2 overflow-hidden rounded-lg"><img src={imageUrl} alt="preview" className="h-20 w-auto object-cover" /></div>}
                      </div>
                      {/* Acompanhamentos */}
                      <div className="space-y-3">
                        <h4 className="text-sm font-bold text-[#eef4ff]">Acompanhamentos</h4>
                        <div className="space-y-2">
                          {addonsList.map((addon, idx) => (
                            <div key={idx} className="flex items-center gap-2 rounded-lg border border-[#2b4062] bg-[#101d33] p-2">
                              <div className="flex-1 text-xs text-[#d6e3f8]">
                                <p className="font-bold">{addon.name}</p>
                                <p className="text-[#93a8c6]">{addon.description}</p>
                                <p className="text-[#8db5ff] font-semibold">{currency(addon.price)}</p>
                              </div>
                              <button type="button" onClick={() => setAddonsList(addonsList.filter((_, i) => i !== idx))} className="rounded px-2 py-1 text-xs font-bold text-[#ff8c98]">✕</button>
                            </div>
                          ))}
                        </div>
                        <div className="space-y-2 rounded-lg border border-[#2f466d] bg-[#091426] p-3">
                          <input value={newAddonName} onChange={(e) => setNewAddonName(e.target.value)} placeholder="Nome do acompanhamento" className="w-full rounded-lg border border-[#1f3a52] bg-[#0a0f1a] px-2 py-1 text-xs text-[#eef4ff]" />
                          <input value={newAddonPrice} onChange={(e) => setNewAddonPrice(e.target.value)} placeholder="Preço" type="number" step="0.01" className="w-full rounded-lg border border-[#1f3a52] bg-[#0a0f1a] px-2 py-1 text-xs text-[#eef4ff]" />
                          <input value={newAddonDesc} onChange={(e) => setNewAddonDesc(e.target.value)} placeholder="Descrição" className="w-full rounded-lg border border-[#1f3a52] bg-[#0a0f1a] px-2 py-1 text-xs text-[#eef4ff]" />
                          <button type="button" onClick={() => { if (newAddonName.trim() && newAddonPrice.trim()) { setAddonsList([...addonsList, { name: newAddonName, price: Number(newAddonPrice), description: newAddonDesc }]); setNewAddonName(""); setNewAddonPrice(""); setNewAddonDesc(""); } }} className="w-full rounded-lg bg-[#0f5bd4] px-2 py-1 text-xs font-bold text-white">+ Adicionar</button>
                        </div>
                      </div>
                      {editingItemId ? (
                        <div className="flex gap-2">
                          <button type="button" onClick={updateItem} className="flex-1 rounded-xl bg-[#0f5bd4] px-4 py-3 font-bold text-white">✏️ Atualizar Item</button>
                          <button type="button" onClick={() => { setEditingItemId(null); setName(""); setDescription(""); setPrice(""); setUnit("un"); setImageUrl(""); setAddonsList([]); setNewAddonName(""); setNewAddonPrice(""); setNewAddonDesc(""); setFormNotice(""); setMenuTab("lista"); }} className="flex-1 rounded-xl border border-[#2f466d] bg-[#13233f] px-4 py-3 font-bold text-[#d6e3f8]">Cancelar</button>
                        </div>
                      ) : (
                        <button type="submit" className="w-full rounded-xl bg-gradient-to-r from-[#c81f2f] to-[#0f5bd4] px-4 py-3 font-bold text-white">Cadastrar Item</button>
                      )}
                    </div>
                  </form>
                )}

                {/* ── Aba: Importar PDF ── */}
                {menuTab === "pdf" && (
                  <section className="space-y-5 rounded-2xl border border-[#0f5bd4]/40 bg-[#0b1424] p-4">
                    <div>
                      <h2 className="text-xl font-bold text-white">Importação em massa (PDF, Excel, Word, PowerPoint)</h2>
                      <p className="mt-1 text-xs text-[#9bb0d0]">
                        Todos os produtos importados aparecem no <strong className="text-[#8db5ff]">Cardápio Digital</strong>.
                        Marque manualmente quais devem ficar <strong className="text-[#8fe0b8]">na vitrine</strong>.
                      </p>
                    </div>

                    {extractedProducts.length === 0 && (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div className="col-span-2">
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.1em] text-[#8db5ff]">
                            Categoria padrão
                          </label>
                          <select
                            value={importDefaultCategory}
                            onChange={(e) => setImportDefaultCategory(e.target.value)}
                            className="w-full rounded-lg border border-[#2f466d] bg-[#091426] px-3 py-2 text-xs text-[#eef4ff]"
                          >
                            {categories.length > 0 ? (
                              categories.map((c) => <option key={c} value={c}>{c}</option>)
                            ) : (
                              <>
                                <option value="Salgado">Salgado</option>
                                <option value="Lanche">Lanche</option>
                                <option value="Bebida">Bebida</option>
                                <option value="Doce">Doce</option>
                              </>
                            )}
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.1em] text-[#8db5ff]">
                            Unidade padrão
                          </label>
                          <select
                            value={importDefaultUnit}
                            onChange={(e) => setImportDefaultUnit(e.target.value)}
                            className="w-full rounded-lg border border-[#2f466d] bg-[#091426] px-3 py-2 text-xs text-[#eef4ff]"
                          >
                            <option value="un">Unidade (un)</option>
                            <option value="kg">Quilo (kg)</option>
                            <option value="g">Grama (g)</option>
                            <option value="l">Litro (l)</option>
                            <option value="ml">Mililitro (ml)</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {extractedProducts.length === 0 && (
                      <>
                        <input
                          ref={pdfInputRef}
                          type="file"
                          accept=".pdf,.xlsx,.xls,.docx,.pptx,.doc,.ppt"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            await importFromInputFile(file);
                            if (pdfInputRef.current) pdfInputRef.current.value = "";
                          }}
                        />
                        <div
                          onDrop={handleImportDrop}
                          onDragOver={handleImportDragOver}
                          onPaste={handleImportPaste}
                          tabIndex={0}
                          className="w-full rounded-xl border-2 border-dashed border-[#2f466d] bg-[#091426] px-4 py-10 text-center outline-none transition hover:border-[#0f5bd4] focus:border-[#0f5bd4]"
                        >
                          <button
                            type="button"
                            onClick={() => pdfInputRef.current?.click()}
                            disabled={pdfProcessing}
                            className="w-full"
                          >
                            {pdfProcessing ? (
                              <div className="space-y-2">
                                <p className="animate-pulse text-lg text-[#8db5ff]">⏳ Processando arquivo...</p>
                                <p className="text-xs text-[#6a88af]">Lendo dados e montando produtos</p>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <p className="text-4xl">📄</p>
                                <p className="text-sm font-bold text-[#d6e3f8]">Clique, arraste e solte, ou cole (Ctrl+V) o arquivo</p>
                                <p className="text-xs text-[#6a88af]">Suporta PDF, Excel (.xlsx/.xls), Word (.docx) e PowerPoint (.pptx)</p>
                              </div>
                            )}
                          </button>
                        </div>
                      </>
                    )}

                    {extractedProducts.length > 0 && (
                      <div className="space-y-3">
                        <input ref={replaceProductImageRef} type="file" accept="image/*" className="hidden" onChange={handleReplaceProductImage} />

                        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#2a4162] bg-[#091426] px-3 py-2">
                          <span className="text-xs font-bold text-white">
                            {extractedProducts.filter((p) => p.selected).length}/{extractedProducts.length} selecionado(s)
                          </span>
                          <span className="text-xs font-bold text-[#8fe0b8]">
                            Vitrine: {extractedProducts.filter((p) => p.selected && p.showInVitrine).length}
                          </span>
                          <button type="button" onClick={() => setExtractedProducts((p) => p.map((x) => ({ ...x, selected: true })))} className="text-xs font-bold text-[#8db5ff] underline">Todos</button>
                          <button type="button" onClick={() => setExtractedProducts((p) => p.map((x) => ({ ...x, selected: false })))} className="text-xs font-bold text-[#ff8c98] underline">Nenhum</button>
                          <button
                            type="button"
                            onClick={() => setExtractedProducts((p) => p.map((x) => (x.selected ? { ...x, showInVitrine: true } : x)))}
                            className="text-xs font-bold text-[#8fe0b8] underline"
                          >
                            Vitrine todos
                          </button>
                          <button
                            type="button"
                            onClick={() => setExtractedProducts((p) => p.map((x) => ({ ...x, showInVitrine: false })))}
                            className="text-xs font-bold text-[#9bb0d0] underline"
                          >
                            Vitrine nenhum
                          </button>
                          <button
                            type="button"
                            onClick={() => { setCurrentImportIdx(0); setShowImportModal(true); }}
                            className="ml-auto rounded-lg border border-[#0f5bd4] bg-[#0f5bd4]/15 px-3 py-1 text-xs font-bold text-[#8db5ff] hover:bg-[#0f5bd4]/30"
                          >
                            ✏️ Revisar produtos
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 max-h-72 overflow-y-auto pr-1">
                          {extractedProducts.map((prod, idx) => {
                            const priceVal = parseFloat(prod.price);
                            const priceOk = !isNaN(priceVal) && priceVal > 0;
                            return (
                              <div
                                key={prod.id}
                                className={`group relative overflow-hidden rounded-xl border-2 text-left transition ${
                                  prod.selected ? "border-[#2a4162] bg-[#101d33]" : "border-[#1a2a40] bg-[#080f1c] opacity-40"
                                } hover:border-[#0f5bd4]`}
                              >
                                <button
                                  type="button"
                                  onClick={() => { setCurrentImportIdx(idx); setShowImportModal(true); }}
                                  className="w-full text-left"
                                >
                                  <div className="aspect-square overflow-hidden bg-[#0b1424]">
                                    {prod.imageUrl ? (
                                      <img src={prod.imageUrl} alt="" className="h-full w-full object-contain p-1" />
                                    ) : (
                                      <div className="flex h-full items-center justify-center text-2xl opacity-20">🍞</div>
                                    )}
                                  </div>
                                  <div className="p-1.5">
                                    <p className="truncate text-[10px] font-bold text-[#eef4ff]">{prod.name || "Sem nome"}</p>
                                    <p className={`text-[10px] font-semibold ${priceOk ? "text-[#8db5ff]" : "text-[#ff8c98]"}`}>
                                      {priceOk ? `R$ ${prod.price}` : "Sem preço"}
                                    </p>
                                  </div>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setExtractedProducts((prev) => prev.map((p) => (
                                    p.id === prod.id ? { ...p, showInVitrine: !p.showInVitrine } : p
                                  )))}
                                  className={`mx-1 mb-1 w-[calc(100%-0.5rem)] rounded-md border px-1.5 py-1 text-[10px] font-bold ${
                                    prod.showInVitrine
                                      ? "border-[#1f8b4c] bg-[#1f8b4c]/15 text-[#8fe0b8]"
                                      : "border-[#365682] bg-[#13233f] text-[#9bb0d0]"
                                  }`}
                                >
                                  {prod.showInVitrine ? "⭐ Na vitrine" : "📚 Só cardápio"}
                                </button>
                              </div>
                            );
                          })}
                        </div>

                        {importingProducts && (
                          <div>
                            <div className="mb-1 flex justify-between text-xs font-bold">
                              <span className="text-[#8db5ff]">Salvando no banco de dados...</span>
                              <span className="text-white">{importProgress}%</span>
                            </div>
                            <div className="h-3 overflow-hidden rounded-full bg-[#13233f]">
                              <div className="h-full rounded-full bg-gradient-to-r from-[#c81f2f] to-[#0f5bd4] transition-all duration-300" style={{ width: `${importProgress}%` }} />
                            </div>
                          </div>
                        )}

                        {importResult && (
                          <div className="rounded-xl border border-[#1f8b4c]/40 bg-[#1f8b4c]/10 p-3">
                            <p className="font-bold text-[#8fe0b8]">
                              ✓ {importResult.success} produto(s) salvo(s) com sucesso
                              {importResult.error > 0 && <span className="ml-2 text-[#ff8c98]">· {importResult.error} com erro</span>}
                            </p>
                            {importResult.details && importResult.details.length > 0 && (
                              <p className="mt-2 text-xs font-semibold text-[#ff8c98]">
                                Erros: {importResult.details.join(" | ")}
                              </p>
                            )}
                            <button
                              type="button"
                              onClick={() => { setExtractedProducts([]); setImportResult(null); setMenuTab("lista"); }}
                              className="mt-2 w-full rounded-xl border border-[#365682] bg-[#13233f] px-4 py-2 text-sm font-bold text-[#d9e7ff]"
                            >
                              Fechar importação
                            </button>
                          </div>
                        )}

                        {!importingProducts && !importResult && (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => { setExtractedProducts([]); setImportResult(null); }}
                              className="rounded-xl border border-[#365682] bg-[#13233f] px-4 py-3 text-sm font-bold text-[#d9e7ff]"
                            >
                              ← Novo PDF
                            </button>
                            <button
                              type="button"
                              onClick={importProducts}
                              disabled={extractedProducts.filter((p) => p.selected && p.name.trim()).length === 0}
                              className="flex-1 rounded-xl bg-gradient-to-r from-[#c81f2f] to-[#0f5bd4] px-4 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              📥 Salvar {extractedProducts.filter((p) => p.selected && p.name.trim()).length} produto(s) no banco
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </section>
                )}
              </div>
            )}

            {/* ─── CARDÁPIO DIGITAL ─── */}
            {activeSection === "cardapio" && (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <div className="flex min-w-max gap-1.5 rounded-2xl border border-[#234062] bg-[#0b1424] p-1.5">
                    {([
                      { id: "qrcode", label: "📱 QR Code" },
                      { id: "vitrine", label: "⭐ Vitrine" },
                    ] as { id: typeof cardapioTab; label: string }[]).map(({ id, label }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setCardapioTab(id)}
                        className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
                          cardapioTab === id
                            ? "bg-gradient-to-r from-[#c81f2f] to-[#0f5bd4] text-white shadow-lg"
                            : "text-[#8db5ff] hover:bg-[#13233f]"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {cardapioTab === "qrcode" && (
                  <section className="rounded-2xl border border-[#234062] bg-[#0b1424] p-4">
                    <h2 className="text-xl font-bold text-white">QR Code do Cardápio Digital</h2>
                    <p className="mt-1 text-xs text-[#9bb0d0]">
                      Esta página exibe todos os produtos cadastrados, inclusive os importados por PDF.
                    </p>
                    <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row sm:items-start">
                      <div className="shrink-0">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${baseUrl}/cardapio`)}`}
                          alt="QR Cardápio Digital"
                          className="h-40 w-40 rounded-xl bg-white p-2 shadow-lg"
                        />
                      </div>
                      <div className="w-full flex-1 space-y-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#8db5ff]">Link público</p>
                          <p className="mt-1 break-all rounded-lg border border-[#2f466d] bg-[#091426] px-3 py-2 font-mono text-sm text-[#eef4ff]">
                            {baseUrl}/cardapio
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(`${baseUrl}/cardapio`);
                                setFormNotice("Link do cardápio copiado!");
                              } catch {
                                setError("Não foi possível copiar o link.");
                              }
                            }}
                            className="rounded-lg bg-[#0f5bd4] px-4 py-2 text-sm font-bold text-white hover:bg-[#0d4db8] transition"
                          >
                            📋 Copiar link
                          </button>
                          <a
                            href={`${baseUrl}/cardapio`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg border border-[#365682] bg-[#13233f] px-4 py-2 text-sm font-bold text-[#d9e7ff] hover:bg-[#1a2f50] transition"
                          >
                            🔗 Abrir página
                          </a>
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {cardapioTab === "vitrine" && (
                  <section className="rounded-2xl border border-[#234062] bg-[#0b1424] p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-2xl font-bold text-white">Todos os produtos</h2>
                      <span className="text-xs font-bold text-[#8db5ff]">{menu.length} produto(s)</span>
                    </div>
                    <p className="mb-4 text-xs text-[#9bb0d0]">
                      <span className="font-bold text-[#8fe0b8]">Na vitrine</span> = aparece no cardápio de pedidos das mesas. <span className="font-bold text-[#8db5ff]">Só no catálogo</span> = aparece apenas na página digital.
                    </p>
                    <div className="grid gap-3 md:grid-cols-2">
                      {menu.map((item) => (
                        <article key={item.id} className="rounded-2xl border border-[#2a4162] bg-[#101d33] p-3">
                          <div className="flex gap-3">
                            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-[#0b1424]">
                              {item.imageUrl ? (
                                <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full items-center justify-center text-2xl opacity-30">🍞</div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="truncate text-sm font-bold text-white">{item.name}</h3>
                              <p className="text-xs text-[#8db5ff]">{item.category}</p>
                              <p className="text-xs font-bold text-[#8db5ff]">{currency(item.price)}</p>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center justify-between gap-2">
                            <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                              item.available ? "bg-[#8fe0b8]/20 text-[#8fe0b8]" : "bg-[#8db5ff]/15 text-[#8db5ff]"
                            }`}>
                              {item.available ? "✓ Na vitrine" : "Só no catálogo"}
                            </span>
                            <button
                              onClick={() => toggleAvailability(item)}
                              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                                item.available
                                  ? "border border-[#2e476f] bg-[#13233f] text-[#d3e4ff] hover:bg-[#1a2f50]"
                                  : "bg-[#1f8b4c] text-white hover:bg-[#18703d]"
                              }`}
                            >
                              {item.available ? "Remover da vitrine" : "Adicionar à vitrine"}
                            </button>
                          </div>
                          <div className="mt-2 flex gap-2">
                            <button
                              onClick={() => editItem(item)}
                              className="flex-1 rounded-lg border border-[#0f5bd4] bg-[#0f5bd4]/20 px-2 py-1.5 text-xs font-bold text-[#0f9fff] hover:bg-[#0f5bd4]/40 transition"
                            >
                              ✏️ Editar
                            </button>
                            <button
                              onClick={() => { setDeleteItemId(item.id); setDeleteModalOpen(true); setDeletePassword(""); }}
                              className="rounded-lg bg-[#c81f2f] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#b01625] transition"
                            >
                              🗑️
                            </button>
                          </div>
                        </article>
                      ))}
                      {menu.length === 0 && (
                        <p className="col-span-2 py-8 text-center text-sm text-[#93a8c6]">Nenhum produto cadastrado ainda.</p>
                      )}
                    </div>
                  </section>
                )}
              </div>
            )}

            {/* ─── TABLES ─── */}
            {activeSection === "tables" && (
              <section className="rounded-2xl border border-[#234062] bg-[#0b1424] p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-3xl text-white">Mesas</h2>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#8db5ff]">Acompanhamento em tempo real</p>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 11 }).map((_, index) => {
                    const tableId = String(index + 1);
                    const orderLink = `${baseUrl}/?mesa=${tableId}`;
                    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(orderLink)}`;
                    const summary = tableSummaries.find((t) => t.tableId === tableId);
                    const isOccupied = Boolean(summary && summary.count > 0);
                    const isCashierQuickTable = tableId === "11";
                    const quickOrderCount = isCashierQuickTable
                      ? quickSelfServiceOrders.length
                      : summary?.count || 0;
                    const showOccupied = isCashierQuickTable ? false : isOccupied;

                    return (
                      <article key={tableId} className="rounded-2xl border border-[#2a4162] bg-[#101d33] p-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xl text-white">Mesa {tableId}</h3>
                          {isCashierQuickTable && quickOrderCount > 0 ? (
                            <button
                              type="button"
                              onClick={() => setSelectedTableId("11")}
                              className="inline-flex items-center gap-2 rounded-lg px-1 py-0.5 hover:bg-[#2a1530]/35"
                              title="Ver pedidos de autoatendimento"
                            >
                              <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[#ff4d6d] px-2 text-xs font-black text-white shadow-[0_0_18px_rgba(255,77,109,0.65)] animate-bounce">
                                {quickOrderCount}
                              </span>
                              <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#ff8c98]">Pedido</span>
                            </button>
                          ) : (
                            <span className={`text-xs font-bold ${showOccupied ? "text-[#ff8c98]" : "text-[#8fe0b8]"}`}>
                              {isCashierQuickTable ? "Autoatendimento" : showOccupied ? "Ocupada" : "Livre"}
                            </span>
                          )}
                          <span className="sr-only">
                            {isCashierQuickTable
                              ? `Mesa de autoatendimento com ${quickOrderCount} pedido(s)`
                              : showOccupied
                              ? "Mesa ocupada"
                              : "Mesa livre"}
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
                                setFormNotice("Link da mesa 11 copiado.");
                              } catch {
                                setError("Nao foi possivel copiar o link.");
                              }
                            }}
                            className="mt-2 w-full rounded-lg border border-[#2e476f] bg-[#13233f] px-2 py-2 text-xs font-bold text-[#8db5ff]"
                          >
                            Copiar link (Mesa 11)
                          </button>
                        )}

                        <p className="mt-2 text-sm font-bold text-white">
                          Pedidos ativos: <span className="text-[#8db5ff]">{summary?.count || 0}</span>
                        </p>

                        <button
                          onClick={() => setSelectedTableId(tableId)}
                          className="mt-2 w-full rounded-lg border border-[#2e476f] bg-[#13233f] px-2 py-2 text-xs font-bold text-[#d3e4ff]"
                        >
                          Ver detalhes
                        </button>

                        {showOccupied && (
                          <button
                            onClick={() => releaseTable(tableId)}
                            className="mt-2 w-full rounded-lg bg-[#1f8b4c] px-2 py-2 text-xs font-bold text-white hover:bg-[#18703d] transition"
                          >
                            ✓ Fechar mesa
                          </button>
                        )}

                        {summary && summary.orders.length > 0 && (
                          <ul className="mt-2 space-y-1 text-xs text-[#d6e3f8]">
                            {summary.orders.slice(0, 3).map((order) => (
                              <li key={order.id} className="flex items-center justify-between gap-1">
                                <span>{order.customerName}</span>
                                <span className={`px-1 py-0.5 rounded text-[10px] font-bold ${
                                  order.status === "novo" ? "bg-[#8db5ff]/20 text-[#8db5ff]" :
                                  order.status === "preparando" ? "bg-[#f7b731]/20 text-[#f7b731]" :
                                  order.status === "pronto" ? "bg-[#8fe0b8]/20 text-[#8fe0b8]" :
                                  "bg-white/10 text-white/60"
                                }`}>{statusLabel(order.status)}</span>
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

            {/* ─── ORDERS ─── */}
            {activeSection === "orders" && (
              <section className="rounded-2xl border border-[#234062] bg-[#0b1424] p-4">
                <h2 className="text-3xl text-white mb-4">Pedidos</h2>

                {/* Filters */}
                <div className="mb-4 flex flex-wrap gap-2">
                  <select
                    value={orderStatusFilter}
                    onChange={(e) => setOrderStatusFilter((e.target.value as OrderStatus) || "")}
                    className="rounded-xl border border-[#2f466d] bg-[#091426] px-3 py-2 text-sm text-[#eef4ff]"
                  >
                    <option value="">Todos os status</option>
                    {statusFlow.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
                  </select>
                  <select
                    value={orderTableFilter}
                    onChange={(e) => setOrderTableFilter(e.target.value)}
                    className="rounded-xl border border-[#2f466d] bg-[#091426] px-3 py-2 text-sm text-[#eef4ff]"
                  >
                    <option value="">Todas as mesas</option>
                    {Array.from({ length: 11 }).map((_, i) => (
                      <option key={i + 1} value={String(i + 1)}>Mesa {i + 1}</option>
                    ))}
                  </select>
                  {(orderStatusFilter || orderTableFilter) && (
                    <button onClick={() => { setOrderStatusFilter(""); setOrderTableFilter(""); }} className="rounded-xl border border-[#2f466d] bg-[#13233f] px-3 py-2 text-sm font-bold text-[#d6e3f8]">
                      Limpar
                    </button>
                  )}
                  <p className="self-center text-xs text-[#8db5ff]">{filteredOrders.length} pedido(s)</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredOrders.length === 0 && <p className="text-sm text-[#93a8c6]">Sem pedidos no momento.</p>}
                  {filteredOrders.map((order) => {
                    const tableId = getOrderTableId(order);
                    const currentIndex = statusFlow.indexOf(order.status);
                    const canAdvance = currentIndex < statusFlow.length - 1;
                    return (
                      <article key={order.id} className="rounded-xl border border-[#2b4062] bg-[#101d33] p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-lg font-bold text-[#eef4ff]">Mesa {tableId}</p>
                          <span className={`text-xs font-bold px-2 py-1 rounded ${
                            order.status === "novo" ? "bg-[#8db5ff]/20 text-[#8db5ff]" :
                            order.status === "preparando" ? "bg-[#f7b731]/20 text-[#f7b731]" :
                            order.status === "pronto" ? "bg-[#8fe0b8]/20 text-[#8fe0b8]" :
                            "bg-white/10 text-white/60"
                          }`}>
                            {statusLabel(order.status)}
                          </span>
                        </div>
                        <p className="text-xs text-[#93a8c6]">{new Date(order.createdAt).toLocaleTimeString("pt-BR")}</p>
                        <ul className="mt-2 space-y-1 text-sm text-[#d6e3f8]">
                          {order.items.map((item) => (
                            <li key={`${order.id}-${item.itemId}`}>{item.quantity}x {item.name}</li>
                          ))}
                        </ul>
                        {order.notes && <p className="mt-2 text-xs italic text-[#93a8c6]">Obs: {order.notes}</p>}
                        {canAdvance && (
                          <button
                            onClick={() => advanceOrderStatus(order.id, order.status)}
                            className="mt-3 w-full rounded-lg bg-[#0f5bd4] px-3 py-2 text-xs font-bold text-white hover:bg-[#0d4db8] transition"
                          >
                            Avançar → {statusLabel(statusFlow[currentIndex + 1])}
                          </button>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ─── PROFILE ─── */}
            {activeSection === "profile" && (
              <section className="grid gap-4 xl:grid-cols-[minmax(0,520px)_1fr]">
                <div className="rounded-2xl border border-[#234062] bg-[#0b1424] p-5">
                  <h2 className="text-2xl text-white">Perfil do admin</h2>
                  <p className="mt-2 text-sm text-[#b2c5e2]">
                    Atualize o usuario e a senha do painel administrativo.
                  </p>
                  <div className="mt-5 space-y-3">
                    <input value={adminUser} onChange={(e) => setAdminUser(e.target.value)} placeholder="Usuario do admin" className="w-full rounded-xl border border-[#2f466d] bg-[#091426] px-4 py-3 text-[#eef4ff]" />
                    <input type="password" value={adminCurrentPassword} onChange={(e) => setAdminCurrentPassword(e.target.value)} placeholder="Senha atual" className="w-full rounded-xl border border-[#2f466d] bg-[#091426] px-4 py-3 text-[#eef4ff]" />
                    <input type="password" value={adminNewPassword} onChange={(e) => setAdminNewPassword(e.target.value)} placeholder="Nova senha" className="w-full rounded-xl border border-[#2f466d] bg-[#091426] px-4 py-3 text-[#eef4ff]" />
                    <input type="password" value={adminConfirmPassword} onChange={(e) => setAdminConfirmPassword(e.target.value)} placeholder="Confirmar nova senha" className="w-full rounded-xl border border-[#2f466d] bg-[#091426] px-4 py-3 text-[#eef4ff]" />
                    <button type="button" onClick={saveAdminProfile} className="w-full rounded-xl bg-gradient-to-r from-[#c81f2f] to-[#0f5bd4] px-4 py-3 font-bold text-white">
                      Salvar perfil
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#234062] bg-[#0b1424] p-5">
                  <h2 className="text-2xl text-white">Regras</h2>
                  <div className="mt-4 space-y-3 text-sm text-[#b2c5e2]">
                    <p>A senha atual é obrigatoria para confirmar a troca.</p>
                    <p>A nova senha passa a valer no proximo login do painel administrativo.</p>
                    <p>O cookie da sessao atual continua valido ate voce sair do painel.</p>
                  </div>
                </div>
              </section>
            )}
          </section>
        </div>
      </div>

      {/* ─── MODAL: Delete product ─── */}
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
              onKeyDown={(e) => { if (e.key === "Enter" && deleteItemId) confirmDelete(deleteItemId); }}
            />
            {error && <p className="mb-3 text-xs font-semibold text-[#ff8c98]">{error}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setDeleteModalOpen(false); setDeleteItemId(null); setDeletePassword(""); setError(""); }} className="flex-1 rounded-lg border border-[#365682] bg-[#13233f] px-4 py-3 font-bold text-[#d9e7ff]">
                Cancelar
              </button>
              <button onClick={() => { if (deleteItemId) confirmDelete(deleteItemId); }} className="flex-1 rounded-lg bg-[#c81f2f] px-4 py-3 font-bold text-white">
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: Delete category ─── */}
      {deleteCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="rounded-2xl border border-[#c81f2f] bg-[#0b1424] p-6 max-w-sm w-full mx-4">
            <h3 className="text-2xl font-bold text-white mb-2">🗑️ Remover categoria</h3>
            <p className="text-sm text-[#b2c5e2] mb-4">Categoria: <strong>{deleteCategoryName}</strong>. Digite a senha 1234 para confirmar.</p>
            <input
              type="password"
              value={deleteCategoryPassword}
              onChange={(e) => setDeleteCategoryPassword(e.target.value)}
              placeholder="Digite 1234..."
              className="w-full rounded-xl border border-[#2f466d] bg-[#091426] px-4 py-3 text-[#eef4ff] mb-4"
              onKeyDown={(e) => { if (e.key === "Enter") confirmDeleteMenuCategory(); }}
            />
            {error && <p className="mb-3 text-xs font-semibold text-[#ff8c98]">{error}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setDeleteCategoryModalOpen(false); setDeleteCategoryName(""); setDeleteCategoryPassword(""); setError(""); }} className="flex-1 rounded-lg border border-[#365682] bg-[#13233f] px-4 py-3 font-bold text-[#d9e7ff]">
                Cancelar
              </button>
              <button onClick={confirmDeleteMenuCategory} className="flex-1 rounded-lg bg-[#c81f2f] px-4 py-3 font-bold text-white">
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: Editar produto importado do PDF ─── */}
      {showImportModal && extractedProducts.length > 0 && (() => {
        const prod = extractedProducts[currentImportIdx];
        if (!prod) return null;
        const update = (patch: Partial<ExtractedProduct>) =>
          setExtractedProducts((prev) => prev.map((p) => (p.id === prod.id ? { ...p, ...patch } : p)));
        const setImageFromFile = async (file?: File) => {
          if (!file || !file.type.startsWith("image/")) return;
          const result = await fileToDataUrlWithoutBackground(file);
          if (result) update({ imageUrl: result });
        };
        const priceVal = parseFloat(prod.price);
        const priceOk = !isNaN(priceVal) && priceVal > 0;
        const selectedCount = extractedProducts.filter((p) => p.selected && p.name.trim()).length;
        const catList = categories.length > 0 ? categories : ["Salgado", "Lanche", "Bebida", "Doce"];
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center p-0 sm:p-4">
            <div className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl border border-[#2a4162] bg-[#0b1424] shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh]">

              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#1e3254] px-5 py-4 shrink-0">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#8db5ff]">Produto {currentImportIdx + 1} de {extractedProducts.length}</p>
                  <p className="mt-0.5 text-base font-bold text-white truncate max-w-[240px]">{prod.name || "Sem nome"}</p>
                </div>
                <button type="button" onClick={() => setShowImportModal(false)}
                  className="rounded-lg border border-[#365682] bg-[#13233f] px-3 py-1.5 text-xs font-bold text-[#d9e7ff] hover:bg-[#1a2f50]">
                  Fechar
                </button>
              </div>

              {/* Body — scrollable */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {/* Imagem — clique para trocar */}
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-[#8db5ff]">Imagem</p>
                  <button
                    type="button"
                    onClick={() => { setReplacingImageProductId(prod.id); replaceProductImageRef.current?.click(); }}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const file = e.dataTransfer.files?.[0];
                      setImageFromFile(file);
                    }}
                    onPaste={(e) => {
                      const file = e.clipboardData.files?.[0];
                      if (!file) return;
                      e.preventDefault();
                      setImageFromFile(file);
                    }}
                    tabIndex={0}
                    className="group relative h-52 w-full overflow-hidden rounded-xl border-2 border-dashed border-[#2f466d] bg-[#091426] hover:border-[#0f5bd4] transition"
                  >
                    {prod.imageUrl ? (
                      <img src={prod.imageUrl} alt="" className="h-full w-full object-contain p-2" />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-2 text-[#4a6890]">
                        <span className="text-4xl">📷</span>
                        <span className="text-xs">Sem imagem</span>
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/55 opacity-0 transition group-hover:opacity-100">
                      <div className="rounded-lg bg-[#0f5bd4] px-4 py-2 text-sm font-bold text-white">
                        📁 Trocar imagem
                      </div>
                    </div>
                  </button>
                  <p className="mt-1 text-center text-[10px] text-[#5a7aaa]">Clique, arraste e solte ou cole (Ctrl+V) para substituir a imagem</p>
                </div>

                {/* Nome */}
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-[0.1em] text-[#8db5ff]">Nome *</label>
                  <input value={prod.name} onChange={(e) => update({ name: e.target.value })}
                    placeholder="Nome do produto"
                    className="w-full rounded-xl border border-[#2f466d] bg-[#091426] px-4 py-3 text-sm text-[#eef4ff] placeholder:text-[#4a6890]" />
                </div>

                {/* Descrição */}
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-[0.1em] text-[#8db5ff]">Descrição</label>
                  <textarea value={prod.description} onChange={(e) => update({ description: e.target.value })}
                    placeholder="Descrição do produto" rows={3}
                    className="w-full resize-none rounded-xl border border-[#2f466d] bg-[#091426] px-4 py-3 text-sm text-[#eef4ff] placeholder:text-[#4a6890]" />
                </div>

                {/* Preço + Unidade */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-[0.1em] text-[#8db5ff]">Preço</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[#8db5ff]">R$</span>
                      <input value={prod.price} onChange={(e) => update({ price: e.target.value })} placeholder="0,00"
                        className={`w-full rounded-xl border bg-[#091426] py-3 pl-10 pr-4 text-sm text-[#eef4ff] ${priceOk ? "border-[#2f466d]" : "border-[#c81f2f]"}`} />
                    </div>
                    {!priceOk && <p className="mt-1 text-[10px] font-semibold text-[#ff8c98]">⚠ Preço inválido</p>}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-[0.1em] text-[#8db5ff]">Unidade</label>
                    <select value={prod.unit} onChange={(e) => update({ unit: e.target.value })}
                      className="w-full rounded-xl border border-[#2f466d] bg-[#091426] px-4 py-3 text-sm text-[#eef4ff]">
                      <option value="un">Unidade (un)</option>
                      <option value="kg">Quilo (kg)</option>
                      <option value="g">Grama (g)</option>
                      <option value="l">Litro (l)</option>
                      <option value="ml">Mililitro (ml)</option>
                    </select>
                  </div>
                </div>

                {/* Categoria */}
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-[0.1em] text-[#8db5ff]">Categoria</label>
                  <select value={prod.category} onChange={(e) => update({ category: e.target.value })}
                    className="w-full rounded-xl border border-[#2f466d] bg-[#091426] px-4 py-3 text-sm text-[#eef4ff]">
                    {catList.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* Incluir / excluir */}
                <label className="flex cursor-pointer items-center gap-3">
                  <input type="checkbox" checked={prod.selected} onChange={(e) => update({ selected: e.target.checked })}
                    className="h-5 w-5 accent-[#0f5bd4]" />
                  <span className="text-sm font-bold text-[#d6e3f8]">Incluir este produto na importação</span>
                </label>

                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={prod.showInVitrine}
                    onChange={(e) => update({ showInVitrine: e.target.checked })}
                    className="h-5 w-5 accent-[#1f8b4c]"
                  />
                  <span className="text-sm font-bold text-[#d6e3f8]">Enviar para vitrine (pedidos)</span>
                </label>
                <p className="text-[11px] text-[#9bb0d0]">Mesmo desligado, o produto continua no Cardápio Digital.</p>
              </div>

              {/* Footer — navegação */}
              <div className="shrink-0 border-t border-[#1e3254] px-5 py-4 space-y-3">
                {/* Barra de progresso */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-[#13233f]">
                    <div className="h-full rounded-full bg-[#0f5bd4] transition-all duration-300"
                      style={{ width: `${((currentImportIdx + 1) / extractedProducts.length) * 100}%` }} />
                  </div>
                  <span className="text-[10px] font-bold text-[#8db5ff] shrink-0">
                    {currentImportIdx + 1}/{extractedProducts.length}
                  </span>
                </div>

                {/* Prev / Next */}
                <div className="flex gap-2">
                  <button type="button" disabled={currentImportIdx === 0}
                    onClick={() => setCurrentImportIdx((i) => i - 1)}
                    className="rounded-xl border border-[#365682] bg-[#13233f] px-4 py-3 text-sm font-bold text-[#d9e7ff] disabled:opacity-40">
                    ← Anterior
                  </button>
                  {currentImportIdx < extractedProducts.length - 1 ? (
                    <button type="button" onClick={() => setCurrentImportIdx((i) => i + 1)}
                      className="flex-1 rounded-xl bg-[#0f5bd4] px-4 py-3 text-sm font-bold text-white hover:bg-[#0d4db8] transition">
                      Próximo →
                    </button>
                  ) : (
                    <button type="button"
                      onClick={() => { setShowImportModal(false); importProducts(); }}
                      disabled={selectedCount === 0 || importingProducts}
                      className="flex-1 rounded-xl bg-gradient-to-r from-[#c81f2f] to-[#0f5bd4] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
                      📥 Importar {selectedCount} produto(s)
                    </button>
                  )}
                </div>

                {/* Atalho para importar sem revisar todos */}
                {currentImportIdx < extractedProducts.length - 1 && (
                  <button type="button"
                    onClick={() => { setShowImportModal(false); importProducts(); }}
                    disabled={selectedCount === 0 || importingProducts}
                    className="w-full rounded-xl border border-[#234062] bg-[#091426] px-4 py-2 text-xs font-bold text-[#8db5ff] disabled:opacity-50">
                    Pular revisão e importar {selectedCount} produto(s) agora
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─── MODAL: Table details ─── */}
      {selectedTableId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-[#365682] bg-[#0b1424] p-6 mx-4">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold text-white">Detalhes da Mesa {selectedTableId}</h3>
              <button onClick={() => setSelectedTableId(null)} className="rounded-lg border border-[#365682] bg-[#13233f] px-3 py-1 text-xs font-bold text-[#d9e7ff]">
                Fechar
              </button>
            </div>

            <p className="mt-2 text-sm text-[#8db5ff]">
              {selectedTableOrders.length} pedido(s) nesta mesa
            </p>

            <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto pr-1">
              {selectedTableOrders.length > 0 ? (
                selectedTableOrders.map((order) => (
                  <article key={order.id} className="rounded-xl border border-[#2b4062] bg-[#101d33] p-3">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-[#eef4ff]">{order.customerName}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-[#93a8c6]">{new Date(order.createdAt).toLocaleTimeString("pt-BR")}</p>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                          order.status === "novo" ? "bg-[#8db5ff]/20 text-[#8db5ff]" :
                          order.status === "preparando" ? "bg-[#f7b731]/20 text-[#f7b731]" :
                          order.status === "pronto" ? "bg-[#8fe0b8]/20 text-[#8fe0b8]" :
                          "bg-white/10 text-white/60"
                        }`}>{statusLabel(order.status)}</span>
                      </div>
                    </div>
                    <ul className="mt-2 space-y-1 text-xs text-[#d6e3f8]">
                      {order.items.map((item) => (
                        <li key={`${order.id}-${item.itemId}`}>{item.quantity}x {item.name}</li>
                      ))}
                    </ul>
                    {order.notes && <p className="mt-2 text-xs italic text-[#93a8c6]">Obs: {order.notes}</p>}
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
