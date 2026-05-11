import { MenuItem, Order, OrderStatus } from "@/lib/types";

const now = new Date().toISOString();

let menu: MenuItem[] = [
  {
    id: "m1",
    name: "Pao na Chapa Premium",
    description: "Pao frances dourado com manteiga de garrafa e toque de ervas.",
    price: 9.9,
    category: "Salgado",
    imageUrl:
      "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=900&q=80",
    available: true,
  },
  {
    id: "m2",
    name: "X-Egg Artesanal",
    description: "Hamburguer bovino, ovo cremoso, queijo e maionese da casa.",
    price: 24.9,
    category: "Lanche",
    imageUrl:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80",
    available: true,
  },
  {
    id: "m3",
    name: "Cafe Gelado de Baunilha",
    description: "Espresso, leite gelado e espuma doce com canela.",
    price: 13.5,
    category: "Bebida",
    imageUrl:
      "https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=900&q=80",
    available: true,
  },
  {
    id: "m4",
    name: "Torta de Chocolate 70%",
    description: "Fatia intensa com ganache e crocante de castanha.",
    price: 16.0,
    category: "Doce",
    imageUrl:
      "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=80",
    available: true,
  },
];

let orders: Order[] = [
  {
    id: "o1",
    customerName: "Mesa 3",
    notes: "Sem cebola no lanche",
    items: [{ itemId: "m2", name: "X-Egg Artesanal", price: 24.9, quantity: 1 }],
    total: 24.9,
    status: "preparando",
    createdAt: now,
  },
];

export function listMenu() {
  return menu;
}

export function addMenuItem(item: Omit<MenuItem, "id">) {
  const newItem: MenuItem = { ...item, id: crypto.randomUUID() };
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
