import { BakerUser, MenuItem, Order, OrderStatus, PaymentMethod, PaymentRecord } from "@/lib/types";

const now = new Date().toISOString();

let menu: MenuItem[] = [
  {
    id: "m1",
    name: "Pao na Chapa Premium",
    description: "Pao frances dourado com manteiga de garrafa e toque de ervas.",
    price: 9.9,
    category: "Salgado",
    unit: "un",
    imageUrl:
      "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=900&q=80",
    available: true,
    addons: ["Requeijao", "Queijo extra"],
  },
  {
    id: "m2",
    name: "X-Egg Artesanal",
    description: "Hamburguer bovino, ovo cremoso, queijo e maionese da casa.",
    price: 24.9,
    category: "Lanche",
    unit: "un",
    imageUrl:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80",
    available: true,
    addons: ["Bacon", "Queijo cheddar", "Molho especial"],
  },
  {
    id: "m3",
    name: "Cafe Gelado de Baunilha",
    description: "Espresso, leite gelado e espuma doce com canela.",
    price: 13.5,
    category: "Bebida",
    unit: "un",
    imageUrl:
      "https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=900&q=80",
    available: true,
    addons: ["Chantilly", "Canela", "Caramelo"],
  },
  {
    id: "m4",
    name: "Torta de Chocolate 70%",
    description: "Fatia intensa com ganache e crocante de castanha.",
    price: 16.0,
    category: "Doce",
    unit: "un",
    imageUrl:
      "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=80",
    available: true,
    addons: ["Calda extra"],
  },
];

let categories: string[] = ["Salgado", "Lanche", "Bebida", "Doce"];

let bakerUser: BakerUser = {
  username: process.env.KITCHEN_USERNAME || "padeiro",
  password: process.env.KITCHEN_PASSWORD || "123456",
};

let orders: Order[] = [
  {
    id: "o1",
    tableId: "3",
    customerName: "Mesa 3",
    notes: "Sem cebola no lanche",
    items: [{ itemId: "m2", name: "X-Egg Artesanal", price: 24.9, quantity: 1 }],
    total: 24.9,
    status: "preparando",
    createdAt: now,
  },
];

let payments: PaymentRecord[] = [];

export function listMenu() {
  return menu;
}

export function addMenuItem(item: Omit<MenuItem, "id">) {
  const newItem: MenuItem = { ...item, id: crypto.randomUUID() };
  if (!categories.includes(newItem.category)) {
    categories = [...categories, newItem.category];
  }
  menu = [newItem, ...menu];
  return newItem;
}

export function updateMenuItem(id: string, patch: Partial<Omit<MenuItem, "id">>) {
  let updated: MenuItem | null = null;
  menu = menu.map((m) => {
    if (m.id !== id) return m;
    updated = { ...m, ...patch };
    return updated;
  });
  return updated;
}

export function deleteMenuItem(id: string) {
  const prevLength = menu.length;
  menu = menu.filter((m) => m.id !== id);
  return prevLength !== menu.length;
}

export function listCategories() {
  return [...categories].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function addCategory(name: string) {
  const normalized = name.trim();
  if (!normalized) return null;
  const exists = categories.some((category) => category.toLowerCase() === normalized.toLowerCase());
  if (exists) return normalized;
  categories = [...categories, normalized];
  return normalized;
}

export function deleteCategory(name: string) {
  const normalized = name.trim().toLowerCase();
  const isUsed = menu.some((item) => item.category.trim().toLowerCase() === normalized);
  if (isUsed) {
    return { removed: false, reason: "used" as const };
  }

  const previousLength = categories.length;
  categories = categories.filter((category) => category.trim().toLowerCase() !== normalized);
  return { removed: previousLength !== categories.length, reason: "ok" as const };
}

export function getBakerUser() {
  return bakerUser;
}

export function updateBakerUser(next: BakerUser) {
  bakerUser = {
    username: next.username.trim(),
    password: next.password,
  };
  return bakerUser;
}

export function listOrders() {
  return orders.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function addOrder(order: Omit<Order, "id" | "createdAt" | "status">) {
  const newOrder: Order = {
    ...order,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: "novo",
  };
  orders = [newOrder, ...orders];
  return newOrder;
}

export function updateOrderStatus(id: string, status: OrderStatus) {
  let updated: Order | null = null;
  orders = orders.map((order) => {
    if (order.id !== id) return order;
    updated = { ...order, status };
    return updated;
  });
  return updated;
}

export function closeTableWithPayment(tableId: string, method: PaymentMethod) {
  const normalizedTableId = tableId.trim();
  const activeOrders = orders.filter(
    (order) => order.tableId.trim() === normalizedTableId && order.status !== "entregue",
  );

  const total = activeOrders.reduce((acc, order) => acc + order.total, 0);

  if (activeOrders.length === 0 || total <= 0) {
    return { closedOrders: 0, total: 0, payment: null as PaymentRecord | null };
  }

  const activeOrderIds = new Set(activeOrders.map((order) => order.id));

  orders = orders.map((order) => {
    if (!activeOrderIds.has(order.id)) return order;
    return { ...order, status: "entregue" };
  });

  const payment: PaymentRecord = {
    id: crypto.randomUUID(),
    tableId: normalizedTableId,
    amount: total,
    method,
    closedAt: new Date().toISOString(),
  };

  payments = [payment, ...payments];

  return { closedOrders: activeOrders.length, total, payment };
}

export function listPayments() {
  return payments.sort((a, b) => (a.closedAt < b.closedAt ? 1 : -1));
}
