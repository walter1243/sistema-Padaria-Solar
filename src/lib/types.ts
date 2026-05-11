export type MenuCategory = string;

export type UnitMeasure = "un" | "kg" | "g" | "l" | "ml";

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: MenuCategory;
  unit: UnitMeasure;
  imageUrl: string;
  available: boolean;
  addons?: string[];
};

export type BakerUser = {
  username: string;
  password: string;
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
  customerName: string;
  notes: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  createdAt: string;
};
