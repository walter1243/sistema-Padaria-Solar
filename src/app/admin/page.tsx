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
  const [showProductForm, setShowProductForm] = useState(false);
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

  const imageFileRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const replaceProductImageRef = useRef<HTMLInputElement>(null);

  const [showPdfImport, setShowPdfImport] = useState(false);
  const [pdfProcessing, setPdfProcessing] = useState(false);
  const [extractedProducts, setExtractedProducts] = useState<ExtractedProduct[]>([]);
  const [importingProducts, setImportingProducts] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ success: number; error: number } | null>(null);
  const [importDefaultCategory, setImportDefaultCategory] = useState("");
  const [importDefaultUnit, setImportDefaultUnit] = useState("un");
  const [replacingImageProductId, setReplacingImageProductId] = useState<string | null>(null);

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

  function handleReplaceProductImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !replacingImageProductId) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setExtractedProducts((prev) =>
        prev.map((p) => (p.id === replacingImageProductId ? { ...p, imageUrl: result } : p)),
      );
      setReplacingImageProductId(null);
    };
    reader.readAsDataURL(file);
    if (replaceProductImageRef.current) replaceProductImageRef.current.value = "";
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      convertImageToDataUrl(file);
    }
    if (imageFileRef.current) imageFileRef.current.value = "";
  }

  async function processPdf(file: File) {
    setPdfProcessing(true);
    setExtractedProducts([]);
    setImportResult(null);
    setError("");
    try {
      // Load pdfjs from CDN at runtime — avoids webpack bundling
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

        // ── 1. Render full page to canvas (fallback image) ──────────────
        const viewport = page.getViewport({ scale: 0.9 });
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = Math.floor(viewport.width);
        pageCanvas.height = Math.floor(viewport.height);
        const pageCtx = pageCanvas.getContext("2d");
        if (pageCtx) await page.render({ canvasContext: pageCtx, viewport }).promise;
        const pageImageFallback = pageCanvas.toDataURL("image/jpeg", 0.6);

        // ── 2. Extract embedded XObject images from the page ─────────────
        // After render(), page.objs is populated with all image resources.
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
              // Skip tiny decorative images
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
                  rgba[p * 4]     = imgData.data[p * 4];
                  rgba[p * 4 + 1] = imgData.data[p * 4 + 1];
                  rgba[p * 4 + 2] = imgData.data[p * 4 + 2];
                  rgba[p * 4 + 3] = imgData.data[p * 4 + 3];
                } else if (ch === 3) {
                  rgba[p * 4]     = imgData.data[p * 3];
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
              embeddedImages.push(ic.toDataURL("image/jpeg", 0.8));
            } catch { /* skip image errors */ }
          }
        } catch { /* fallback to page render if opList fails */ }

        // ── 3. Extract text with positions ───────────────────────────────
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

        // ── 4. Parse products — price anchors each block ──────────────────
        // Accepts: R$ 12,90 | R$ 1.290,00 | R$12,90
        // ── 4-5. Defaults + parse products ──────────────────────────────
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
            name: buf.name.trim(),
            description: (buf.desc || buf.name).trim().slice(0, 220),
            price: "0",
            unit: defaultUnit,
            category: defaultCat,
            imageUrl: "",
          });
        }

        // For scanned/image PDFs with no text: add one empty product per page
        // so the user can fill in details manually (image is the page render).
        if (pageProducts.length === 0 && pageImageFallback) {
          allProducts.push({
            id: crypto.randomUUID(),
            selected: true,
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
        setExtractedProducts(allProducts);
        const textCount = allProducts.filter((p) => p.name).length;
        const emptyCount = allProducts.length - textCount;
        setFormNotice(
          `${allProducts.length} produto(s) extraído(s).` +
          (emptyCount > 0 ? ` ${emptyCount} página(s) sem texto — preencha manualmente.` : " Revise antes de importar."),
        );
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

    const products = toImport.map((p) => ({
      name: p.name.trim(),
      description: (p.description || p.name).trim(),
      price: Math.max(parseFloat(p.price) || 0.01, 0.01),
      category: p.category || categories[0] || "Salgado",
      unit: p.unit || "un",
      imageUrl: p.imageUrl,
      available: true,
    }));

    // Fake progress while calling bulk endpoint
    const progressInterval = setInterval(() => {
      setImportProgress((v) => Math.min(v + 5, 90));
    }, 200);

    try {
      const res = await fetch("/api/menu/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products }),
      });
      clearInterval(progressInterval);
      setImportProgress(100);

      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        setError(payload.error || "Erro ao importar produtos.");
        setImportingProducts(false);
        return;
      }

      const data = (await res.json()) as { success: number; errors: number };
      setImportResult({ success: data.success, error: data.errors });
      if (data.success > 0) loadData();
    } catch (e) {
      clearInterval(progressInterval);
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
    setShowProductForm(true);
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
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#234062] bg-[#0b1424] p-3">
                  <p className="flex-1 text-sm font-bold text-[#d9e7ff]">Cadastro de produtos</p>
                  <button
                    type="button"
                    onClick={() => { setShowPdfImport(false); setShowProductForm((v) => !v); }}
                    className="rounded-lg border border-[#2f466d] bg-[#13233f] px-3 py-2 text-xs font-bold text-[#d6e3f8]"
                  >
                    {showProductForm && !showPdfImport ? "Fechar cadastro" : "Abrir cadastro"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowProductForm(false); setShowPdfImport((v) => !v); }}
                    className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
                      showPdfImport
                        ? "bg-[#0f5bd4] text-white"
                        : "border border-[#0f5bd4] bg-[#0f5bd4]/15 text-[#8db5ff] hover:bg-[#0f5bd4]/30"
                    }`}
                  >
                    📥 Importar via PDF
                  </button>
                </div>

                {/* ── PDF Import Panel ── */}
                {showPdfImport && (
                  <section className="space-y-5 rounded-2xl border border-[#0f5bd4]/40 bg-[#0b1424] p-4">
                    {/* Header */}
                    <div>
                      <h2 className="text-xl font-bold text-white">Importação em massa via PDF</h2>
                      <p className="mt-1 text-xs text-[#9bb0d0]">
                        Funciona com <strong className="text-[#8db5ff]">qualquer tipo de PDF</strong> — digital ou escaneado.
                        Para PDFs escaneados ou sem texto, os campos ficam em branco para preenchimento manual.
                      </p>
                    </div>

                    {/* ── Configurações padrão (visível antes de carregar PDF) ── */}
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
                        <div className="col-span-2 sm:col-span-2">
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

                    {/* ── Upload area ── */}
                    {extractedProducts.length === 0 && (
                      <>
                        <input
                          ref={pdfInputRef}
                          type="file"
                          accept=".pdf"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) await processPdf(file);
                            if (pdfInputRef.current) pdfInputRef.current.value = "";
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => pdfInputRef.current?.click()}
                          disabled={pdfProcessing}
                          className="w-full rounded-xl border-2 border-dashed border-[#2f466d] bg-[#091426] px-4 py-10 text-center transition hover:border-[#0f5bd4] disabled:opacity-60"
                        >
                          {pdfProcessing ? (
                            <div className="space-y-2">
                              <p className="animate-pulse text-lg text-[#8db5ff]">⏳ Processando PDF...</p>
                              <p className="text-xs text-[#6a88af]">Renderizando páginas e extraindo conteúdo</p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <p className="text-4xl">📄</p>
                              <p className="text-sm font-bold text-[#d6e3f8]">Clique para selecionar o PDF</p>
                              <p className="text-xs text-[#6a88af]">
                                Cada página vira um produto com imagem, descrição e preço extraídos
                              </p>
                            </div>
                          )}
                        </button>
                      </>
                    )}

                    {/* ── Preview dos produtos extraídos ── */}
                    {extractedProducts.length > 0 && (
                      <div className="space-y-4">
                        {/* Controls bar */}
                        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#2a4162] bg-[#091426] p-3">
                          <span className="text-xs font-bold text-white">
                            {extractedProducts.filter((p) => p.selected).length}/{extractedProducts.length} selecionado(s)
                          </span>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => setExtractedProducts((p) => p.map((x) => ({ ...x, selected: true })))}
                              className="text-xs font-bold text-[#8db5ff] underline">Todos</button>
                            <button type="button" onClick={() => setExtractedProducts((p) => p.map((x) => ({ ...x, selected: false })))}
                              className="text-xs font-bold text-[#ff8c98] underline">Nenhum</button>
                          </div>
                          {/* Aplicar categoria/unidade a todos */}
                          <div className="ml-auto flex flex-wrap gap-2">
                            <select
                              defaultValue=""
                              onChange={(e) => {
                                if (!e.target.value) return;
                                setExtractedProducts((p) => p.map((x) => ({ ...x, category: e.target.value })));
                                e.target.value = "";
                              }}
                              className="rounded-lg border border-[#2f466d] bg-[#0b1424] px-2 py-1 text-[10px] text-[#8db5ff]"
                            >
                              <option value="">Aplicar categoria a todos…</option>
                              {(categories.length > 0 ? categories : ["Salgado","Lanche","Bebida","Doce"]).map((c) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                            <select
                              defaultValue=""
                              onChange={(e) => {
                                if (!e.target.value) return;
                                setExtractedProducts((p) => p.map((x) => ({ ...x, unit: e.target.value })));
                                e.target.value = "";
                              }}
                              className="rounded-lg border border-[#2f466d] bg-[#0b1424] px-2 py-1 text-[10px] text-[#8db5ff]"
                            >
                              <option value="">Aplicar unidade a todos…</option>
                              <option value="un">un</option>
                              <option value="kg">kg</option>
                              <option value="g">g</option>
                              <option value="l">l</option>
                              <option value="ml">ml</option>
                            </select>
                          </div>
                        </div>

                        {/* Hidden input for per-product image replacement */}
                        <input
                          ref={replaceProductImageRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleReplaceProductImage}
                        />

                        {/* Product cards */}
                        <div className="max-h-[620px] space-y-3 overflow-y-auto pr-1">
                          {extractedProducts.map((prod, idx) => {
                            const priceVal = parseFloat(prod.price);
                            const priceOk = !isNaN(priceVal) && priceVal > 0;
                            const update = (patch: Partial<ExtractedProduct>) =>
                              setExtractedProducts((prev) =>
                                prev.map((p) => (p.id === prod.id ? { ...p, ...patch } : p)),
                              );
                            return (
                              <div
                                key={prod.id}
                                className={`rounded-2xl border p-3 transition ${
                                  prod.selected ? "border-[#2a4162] bg-[#101d33]" : "border-[#1a2a40] bg-[#080f1c] opacity-40"
                                }`}
                              >
                                {/* Card header */}
                                <div className="mb-3 flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={prod.selected}
                                    onChange={(e) => update({ selected: e.target.checked })}
                                    className="h-4 w-4 accent-[#0f5bd4]"
                                  />
                                  <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#8db5ff]">
                                    Produto {idx + 1}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setExtractedProducts((p) => p.filter((x) => x.id !== prod.id))}
                                    className="ml-auto rounded-lg bg-[#c81f2f]/20 px-2 py-1 text-[10px] font-bold text-[#ff8c98] hover:bg-[#c81f2f]/40"
                                  >
                                    ✕ Remover
                                  </button>
                                </div>

                                <div className="flex gap-3">
                                  {/* Image — click to replace */}
                                  <div className="shrink-0">
                                    <button
                                      type="button"
                                      title="Clique para trocar a imagem"
                                      onClick={() => {
                                        setReplacingImageProductId(prod.id);
                                        replaceProductImageRef.current?.click();
                                      }}
                                      className="group relative h-24 w-24 overflow-hidden rounded-xl border-2 border-dashed border-[#2f466d] bg-[#0b1424] hover:border-[#0f5bd4]"
                                    >
                                      {prod.imageUrl ? (
                                        <img src={prod.imageUrl} alt="" className="h-full w-full object-cover" />
                                      ) : (
                                        <div className="flex h-full items-center justify-center text-3xl opacity-20">🍞</div>
                                      )}
                                      <div className="absolute inset-0 flex items-end justify-center bg-black/50 opacity-0 transition group-hover:opacity-100">
                                        <span className="mb-1 text-[9px] font-bold text-white">Trocar</span>
                                      </div>
                                    </button>
                                    <p className="mt-1 text-center text-[9px] text-[#5a7aaa]">Clique p/ trocar</p>
                                  </div>

                                  {/* Fields */}
                                  <div className="min-w-0 flex-1 space-y-2">
                                    {/* Name */}
                                    <input
                                      value={prod.name}
                                      onChange={(e) => update({ name: e.target.value })}
                                      placeholder="Nome do produto *"
                                      className="w-full rounded-lg border border-[#2f466d] bg-[#091426] px-2 py-1.5 text-xs text-[#eef4ff] placeholder:text-[#4a6890]"
                                    />
                                    {/* Description */}
                                    <textarea
                                      value={prod.description}
                                      onChange={(e) => update({ description: e.target.value })}
                                      placeholder="Descrição do produto"
                                      rows={2}
                                      className="w-full resize-none rounded-lg border border-[#2f466d] bg-[#091426] px-2 py-1.5 text-xs text-[#eef4ff] placeholder:text-[#4a6890]"
                                    />
                                    {/* Price + Unit + Category */}
                                    <div className="flex flex-wrap gap-2">
                                      {/* Price */}
                                      <div className="relative w-28 shrink-0">
                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#8db5ff]">R$</span>
                                        <input
                                          value={prod.price}
                                          onChange={(e) => update({ price: e.target.value })}
                                          placeholder="0,00"
                                          className={`w-full rounded-lg border bg-[#091426] py-1.5 pl-7 pr-2 text-xs text-[#eef4ff] ${
                                            priceOk ? "border-[#2f466d]" : "border-[#c81f2f]"
                                          }`}
                                        />
                                      </div>
                                      {/* Unit */}
                                      <select
                                        value={prod.unit}
                                        onChange={(e) => update({ unit: e.target.value })}
                                        className="rounded-lg border border-[#2f466d] bg-[#091426] px-2 py-1.5 text-xs text-[#eef4ff]"
                                      >
                                        <option value="un">un</option>
                                        <option value="kg">kg</option>
                                        <option value="g">g</option>
                                        <option value="l">l</option>
                                        <option value="ml">ml</option>
                                      </select>
                                      {/* Category */}
                                      <select
                                        value={prod.category}
                                        onChange={(e) => update({ category: e.target.value })}
                                        className="flex-1 rounded-lg border border-[#2f466d] bg-[#091426] px-2 py-1.5 text-xs text-[#eef4ff]"
                                      >
                                        {(categories.length > 0 ? categories : ["Salgado","Lanche","Bebida","Doce"]).map((c) => (
                                          <option key={c} value={c}>{c}</option>
                                        ))}
                                      </select>
                                    </div>
                                    {!priceOk && (
                                      <p className="text-[10px] font-semibold text-[#ff8c98]">⚠ Defina um preço maior que 0</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Progress */}
                        {importingProducts && (
                          <div className="mt-2">
                            <div className="mb-1 flex justify-between text-xs font-bold">
                              <span className="text-[#8db5ff]">Salvando no banco de dados...</span>
                              <span className="text-white">{importProgress}%</span>
                            </div>
                            <div className="h-3 overflow-hidden rounded-full bg-[#13233f]">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-[#c81f2f] to-[#0f5bd4] transition-all duration-300"
                                style={{ width: `${importProgress}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Result */}
                        {importResult && (
                          <div className="rounded-xl border border-[#1f8b4c]/40 bg-[#1f8b4c]/10 p-4">
                            <p className="font-bold text-[#8fe0b8]">
                              ✓ {importResult.success} produto(s) salvo(s) no banco com sucesso
                              {importResult.error > 0 && <span className="ml-2 text-[#ff8c98]">· {importResult.error} com erro</span>}
                            </p>
                            <button
                              type="button"
                              onClick={() => { setExtractedProducts([]); setImportResult(null); setShowPdfImport(false); }}
                              className="mt-3 w-full rounded-xl border border-[#365682] bg-[#13233f] px-4 py-3 text-sm font-bold text-[#d9e7ff]"
                            >
                              Fechar importação
                            </button>
                          </div>
                        )}

                        {/* Import button */}
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

                {/* Categories */}
                <section className="rounded-2xl border border-[#234062] bg-[#0b1424] p-4">
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
                      className="rounded-xl bg-[#0f5bd4] px-4 py-2 font-bold text-white"
                    >
                      Adicionar
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {categories.map((cat) => (
                      <div key={cat} className="flex items-center gap-2 rounded-lg border border-[#2b4062] bg-[#101d33] px-3 py-2">
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
                  {/* Product form */}
                  {showProductForm && (
                    <form
                      onSubmit={addMenu}
                      className="h-fit rounded-2xl border border-[#234062] bg-[#0b1424] p-4"
                    >
                      <h2 className="text-2xl text-white">{editingItemId ? "Editar Item" : "Novo Item"}</h2>
                      <div className="mt-4 space-y-2">
                        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" required className="w-full rounded-xl border border-[#2f466d] bg-[#091426] px-3 py-2 text-[#eef4ff]" />
                        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descricao" required className="h-20 w-full resize-none rounded-xl border border-[#2f466d] bg-[#091426] px-3 py-2 text-[#eef4ff]" />
                        <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" min="0" step="0.01" placeholder="Preco (apenas referencia no cardapio)" required className="w-full rounded-xl border border-[#2f466d] bg-[#091426] px-3 py-2 text-[#eef4ff]" />
                        <select value={category} onChange={(e) => setCategory(e.target.value as MenuCategory)} className="w-full rounded-xl border border-[#2f466d] bg-[#091426] px-3 py-2 text-[#eef4ff]">
                          {categories.length > 0 ? (
                            categories.map((cat) => <option key={cat}>{cat}</option>)
                          ) : (
                            <><option>Salgado</option><option>Lanche</option><option>Bebida</option><option>Doce</option></>
                          )}
                        </select>
                        <select value={unit} onChange={(e) => setUnit(e.target.value as UnitMeasure)} className="w-full rounded-xl border border-[#2f466d] bg-[#091426] px-3 py-2 text-[#eef4ff]">
                          <option value="un">Unidade (un)</option>
                          <option value="kg">Quilo (kg)</option>
                          <option value="g">Grama (g)</option>
                          <option value="l">Litro (l)</option>
                          <option value="ml">Mililitro (ml)</option>
                        </select>
                        <div onDrop={handleImageDrop} onDragOver={handleImageDragOver} className="w-full rounded-xl border-2 border-dashed border-[#2f466d] bg-[#091426] px-3 py-4 transition-colors hover:border-[#0f5bd4]">
                          <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} onPaste={handleImagePaste} placeholder="Cole (Ctrl+V) ou arraste a imagem aqui" className="w-full bg-transparent text-[#eef4ff] placeholder-[#7a95bd] outline-none" />
                          <input
                            ref={imageFileRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => imageFileRef.current?.click()}
                            className="mt-3 w-full rounded-lg border border-[#2f466d] bg-[#13233f] px-3 py-2 text-xs font-bold text-[#8db5ff] hover:bg-[#1a2f50] transition"
                          >
                            📁 Selecionar imagem (celular ou computador)
                          </button>
                          {imageUrl && (
                            <div className="mt-2 overflow-hidden rounded-lg">
                              <img src={imageUrl} alt="preview" className="h-20 w-auto object-cover" />
                            </div>
                          )}
                        </div>

                        {/* Addons */}
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
                                <button type="button" onClick={() => setAddonsList(addonsList.filter((_, i) => i !== idx))} className="rounded px-2 py-1 text-xs font-bold text-[#ff8c98] hover:bg-[#1a2a3f]">✕</button>
                              </div>
                            ))}
                          </div>
                          <div className="space-y-2 rounded-lg border border-[#2f466d] bg-[#091426] p-3">
                            <input value={newAddonName} onChange={(e) => setNewAddonName(e.target.value)} placeholder="Nome do acompanhamento" className="w-full rounded-lg border border-[#1f3a52] bg-[#0a0f1a] px-2 py-1 text-xs text-[#eef4ff]" />
                            <input value={newAddonPrice} onChange={(e) => setNewAddonPrice(e.target.value)} placeholder="Preço" type="number" step="0.01" className="w-full rounded-lg border border-[#1f3a52] bg-[#0a0f1a] px-2 py-1 text-xs text-[#eef4ff]" />
                            <input value={newAddonDesc} onChange={(e) => setNewAddonDesc(e.target.value)} placeholder="Descrição" className="w-full rounded-lg border border-[#1f3a52] bg-[#0a0f1a] px-2 py-1 text-xs text-[#eef4ff]" />
                            <button
                              type="button"
                              onClick={() => {
                                if (newAddonName.trim() && newAddonPrice.trim()) {
                                  setAddonsList([...addonsList, { name: newAddonName, price: Number(newAddonPrice), description: newAddonDesc }]);
                                  setNewAddonName(""); setNewAddonPrice(""); setNewAddonDesc("");
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
                            <button type="button" onClick={updateItem} className="flex-1 rounded-xl bg-[#0f5bd4] px-4 py-3 font-bold text-white">✏️ Atualizar Item</button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingItemId(null);
                                setName(""); setDescription(""); setPrice(""); setUnit("un"); setImageUrl(""); setAddonsList([]);
                                setNewAddonName(""); setNewAddonPrice(""); setNewAddonDesc("");
                                setFormNotice("");
                              }}
                              className="flex-1 rounded-xl border border-[#2f466d] bg-[#13233f] px-4 py-3 font-bold text-[#d6e3f8]"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button type="submit" className="w-full rounded-xl bg-gradient-to-r from-[#c81f2f] to-[#0f5bd4] px-4 py-3 font-bold text-white">
                            Cadastrar Item
                          </button>
                        )}
                      </div>
                    </form>
                  )}

                  {/* Product list */}
                  <section className="rounded-2xl border border-[#234062] bg-[#0b1424] p-4">
                    <h2 className="text-3xl text-white mb-4">Cardápio Atual</h2>
                    <div className="mb-4 space-y-2">
                      <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="🔍 Pesquisar produto por nome ou descrição..." className="w-full rounded-xl border border-[#2f466d] bg-[#091426] px-4 py-3 text-[#eef4ff] placeholder:text-[#7a94b8]" />
                      <div className="flex gap-2">
                        <select value={searchCategory} onChange={(e) => setSearchCategory((e.target.value as MenuCategory) || "")} className="flex-1 rounded-xl border border-[#2f466d] bg-[#091426] px-4 py-2 text-[#eef4ff]">
                          <option value="">Todas as categorias</option>
                          {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                        {(searchQuery || searchCategory) && (
                          <button onClick={() => { setSearchQuery(""); setSearchCategory(""); }} className="rounded-xl border border-[#2f466d] bg-[#13233f] px-4 py-2 text-sm font-bold text-[#d6e3f8]">
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
                              {item.available ? "🔒 Desativar" : "🔓 Ativar"}
                            </button>
                            <button onClick={() => { setDeleteItemId(item.id); setDeleteModalOpen(true); setDeletePassword(""); }} className="rounded-lg bg-[#c81f2f] px-3 py-2 text-xs font-bold text-white hover:bg-[#b01625] transition">🗑️ Excluir</button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                </div>
              </div>
            )}

            {/* ─── CARDÁPIO DIGITAL ─── */}
            {activeSection === "cardapio" && (
              <div className="space-y-4">

                {/* QR code + link card */}
                <section className="rounded-2xl border border-[#234062] bg-[#0b1424] p-4">
                  <h2 className="text-xl font-bold text-white">QR Code do Cardápio Digital</h2>
                  <p className="mt-1 text-xs text-[#9bb0d0]">
                    Salve este QR no Instagram para clientes visualizarem todos os seus produtos.
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
                      <p className="text-xs text-[#6a88af]">
                        Esta página exibe <strong className="text-[#8db5ff]">todos</strong> os produtos cadastrados e não possui carrinho — é só para exposição.
                      </p>
                    </div>
                  </div>
                </section>

                {/* Product registration toggle */}
                <div className="flex items-center justify-between rounded-2xl border border-[#234062] bg-[#0b1424] p-3">
                  <p className="text-sm font-bold text-[#d9e7ff]">Cadastrar produto no catálogo</p>
                  <button
                    type="button"
                    onClick={() => setShowProductForm((v) => !v)}
                    className="rounded-lg border border-[#2f466d] bg-[#13233f] px-3 py-2 text-xs font-bold text-[#d6e3f8]"
                  >
                    {showProductForm ? "Fechar cadastro" : "Abrir cadastro"}
                  </button>
                </div>

                <div className={`grid gap-4 ${showProductForm ? "xl:grid-cols-[360px_1fr]" : "xl:grid-cols-1"}`}>
                  {/* Form (shared state with Produtos section) */}
                  {showProductForm && (
                    <form onSubmit={addMenu} className="h-fit rounded-2xl border border-[#234062] bg-[#0b1424] p-4">
                      <h2 className="text-2xl text-white">{editingItemId ? "Editar Item" : "Novo Item"}</h2>
                      <div className="mt-4 space-y-2">
                        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" required className="w-full rounded-xl border border-[#2f466d] bg-[#091426] px-3 py-2 text-[#eef4ff]" />
                        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descricao" required className="h-20 w-full resize-none rounded-xl border border-[#2f466d] bg-[#091426] px-3 py-2 text-[#eef4ff]" />
                        <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" min="0" step="0.01" placeholder="Preco (referencia no cardapio)" required className="w-full rounded-xl border border-[#2f466d] bg-[#091426] px-3 py-2 text-[#eef4ff]" />
                        <select value={category} onChange={(e) => setCategory(e.target.value as MenuCategory)} className="w-full rounded-xl border border-[#2f466d] bg-[#091426] px-3 py-2 text-[#eef4ff]">
                          {categories.length > 0 ? (
                            categories.map((cat) => <option key={cat}>{cat}</option>)
                          ) : (
                            <><option>Salgado</option><option>Lanche</option><option>Bebida</option><option>Doce</option></>
                          )}
                        </select>
                        <select value={unit} onChange={(e) => setUnit(e.target.value as UnitMeasure)} className="w-full rounded-xl border border-[#2f466d] bg-[#091426] px-3 py-2 text-[#eef4ff]">
                          <option value="un">Unidade (un)</option>
                          <option value="kg">Quilo (kg)</option>
                          <option value="g">Grama (g)</option>
                          <option value="l">Litro (l)</option>
                          <option value="ml">Mililitro (ml)</option>
                        </select>
                        <div onDrop={handleImageDrop} onDragOver={handleImageDragOver} className="w-full rounded-xl border-2 border-dashed border-[#2f466d] bg-[#091426] px-3 py-4 transition-colors hover:border-[#0f5bd4]">
                          <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} onPaste={handleImagePaste} placeholder="Cole (Ctrl+V) ou arraste a imagem aqui" className="w-full bg-transparent text-[#eef4ff] placeholder-[#7a95bd] outline-none" />
                          <input ref={imageFileRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                          <button type="button" onClick={() => imageFileRef.current?.click()} className="mt-3 w-full rounded-lg border border-[#2f466d] bg-[#13233f] px-3 py-2 text-xs font-bold text-[#8db5ff] hover:bg-[#1a2f50] transition">
                            📁 Selecionar imagem (celular ou computador)
                          </button>
                          {imageUrl && (
                            <div className="mt-2 overflow-hidden rounded-lg">
                              <img src={imageUrl} alt="preview" className="h-20 w-auto object-cover" />
                            </div>
                          )}
                        </div>
                        {/* Addons */}
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
                            <button type="button" onClick={() => { setEditingItemId(null); setName(""); setDescription(""); setPrice(""); setUnit("un"); setImageUrl(""); setAddonsList([]); setNewAddonName(""); setNewAddonPrice(""); setNewAddonDesc(""); setFormNotice(""); }} className="flex-1 rounded-xl border border-[#2f466d] bg-[#13233f] px-4 py-3 font-bold text-[#d6e3f8]">Cancelar</button>
                          </div>
                        ) : (
                          <button type="submit" className="w-full rounded-xl bg-gradient-to-r from-[#c81f2f] to-[#0f5bd4] px-4 py-3 font-bold text-white">Cadastrar Item</button>
                        )}
                      </div>
                    </form>
                  )}

                  {/* All products with vitrine toggle */}
                  <section className="rounded-2xl border border-[#234062] bg-[#0b1424] p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-2xl font-bold text-white">Todos os produtos</h2>
                      <span className="text-xs font-bold text-[#8db5ff]">{menu.length} produto(s)</span>
                    </div>
                    <p className="mb-4 text-xs text-[#9bb0d0]">
                      <span className="font-bold text-[#8fe0b8]">Na vitrine</span> = aparece no cardápio de pedidos das mesas. &nbsp;
                      <span className="font-bold text-[#8db5ff]">Só no catálogo</span> = exibido apenas na página do cardápio digital.
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

                          {/* Vitrine status + toggle */}
                          <div className="mt-3 flex items-center justify-between gap-2">
                            <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                              item.available
                                ? "bg-[#8fe0b8]/20 text-[#8fe0b8]"
                                : "bg-[#8db5ff]/15 text-[#8db5ff]"
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

                          {/* CRUD actions */}
                          <div className="mt-2 flex gap-2">
                            <button
                              onClick={() => { editItem(item); }}
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
                        <p className="col-span-2 py-8 text-center text-sm text-[#93a8c6]">
                          Nenhum produto cadastrado ainda.
                        </p>
                      )}
                    </div>
                  </section>
                </div>
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

                        {isOccupied && (
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
              {selectedTableSummary?.count || 0} pedido(s) ativo(s) nesta mesa
            </p>

            <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto pr-1">
              {selectedTableSummary && selectedTableSummary.orders.length > 0 ? (
                selectedTableSummary.orders.map((order) => (
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
