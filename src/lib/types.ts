export type MenuCategory = string;

export type UnitMeasure = "un" | "kg" | "g" | "l" | "ml";

export type Addon = {
  name: string;
  price: number;
  description: string;
};

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: MenuCategory;
  unit: UnitMeasure;
  imageUrl: string;
  available: boolean;
  addons?: Addon[];
};

export type BakerUser = {
  username: string;
  password: string;
};

export type PaymentMethod = "dinheiro" | "pix" | "cartao";

export type PaymentRecord = {
  id: string;
  tableId: string;
  amount: number;
  method: PaymentMethod;
  closedAt: string;
};

export type OrderStatus = "novo" | "preparando" | "pronto" | "entregue";

export type OrderItem = {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
};

export type Order = {
  id: string;
  tableId: string;
  sessionId?: string;
  customerName: string;
  notes: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  createdAt: string;
};
