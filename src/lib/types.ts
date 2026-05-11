export type MenuCategory = "Salgado" | "Lanche" | "Bebida" | "Doce";

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: MenuCategory;
  imageUrl: string;
  available: boolean;
  addons?: string[];
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
  customerName: string;
  notes: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  createdAt: string;
};
