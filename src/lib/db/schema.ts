import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Categories ──────────────────────────────────────────────────────────────
export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
});

export const adminAccounts = pgTable("admin_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Products (cardápio) ─────────────────────────────────────────────────────
export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  stock: integer("stock").notNull().default(0),
  categoryId: uuid("category_id").references(() => categories.id),
  unit: varchar("unit", { length: 10 }).notNull().default("un"),
  imageUrl: text("image_url"),
  available: boolean("available").notNull().default(true),
});

// ─── Addons ───────────────────────────────────────────────────────────────────
export const addons = pgTable("addons", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  description: text("description"),
});

// ─── Orders ───────────────────────────────────────────────────────────────────
export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  tableId: varchar("table_id", { length: 50 }),
  sessionId: varchar("session_id", { length: 100 }),
  customerName: varchar("customer_name", { length: 200 }).notNull(),
  notes: text("notes"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("novo"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tableSessions = pgTable(
  "table_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tableId: varchar("table_id", { length: 50 }).notNull(),
    sessionId: varchar("session_id", { length: 100 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    openedAt: timestamp("opened_at").defaultNow().notNull(),
    closedAt: timestamp("closed_at"),
  },
  (table) => ({
    tableSessionUnique: uniqueIndex("table_sessions_table_session_unique").on(
      table.tableId,
      table.sessionId,
    ),
  }),
);

// ─── Order Items ──────────────────────────────────────────────────────────────
export const orderItems = pgTable("order_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id),
  name: varchar("name", { length: 200 }).notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull(),
});

// ─── Payments ─────────────────────────────────────────────────────────────────
export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  tableId: varchar("table_id", { length: 50 }).notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  method: varchar("method", { length: 20 }).notNull(),
  closedAt: timestamp("closed_at").defaultNow().notNull(),
});

// ─── Relations ────────────────────────────────────────────────────────────────
export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const adminAccountsRelations = relations(adminAccounts, () => ({}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  addons: many(addons),
  orderItems: many(orderItems),
}));

export const addonsRelations = relations(addons, ({ one }) => ({
  product: one(products, {
    fields: [addons.productId],
    references: [products.id],
  }),
}));

export const ordersRelations = relations(orders, ({ many }) => ({
  items: many(orderItems),
}));

export const tableSessionsRelations = relations(tableSessions, () => ({}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));
