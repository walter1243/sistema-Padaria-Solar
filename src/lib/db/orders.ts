import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { orderItems, orders, payments, products, tableSessions } from "@/lib/db/schema";
import { Order, OrderItem, OrderStatus, PaymentMethod, PaymentRecord, ReceiptLineItem, TableReceipt } from "@/lib/types";

export type TableSessionValidation = {
  allowed: boolean;
  reason?: "missing-session" | "session-closed" | "table-in-use";
};

export type ActiveTableSummary = {
  tableId: string;
  total: number;
  count: number;
  orders: Order[];
};

type CreateOrderInput = {
  tableId: string;
  sessionId: string;
  customerName: string;
  notes: string;
  items: OrderItem[];
  total: number;
};

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export async function listOrdersFromDb(): Promise<Order[]> {
  const orderRows = await db.select().from(orders).orderBy(desc(orders.createdAt));
  const orderIds = orderRows.map((order) => order.id);

  const itemRows = orderIds.length
    ? await db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds))
    : [];

  const itemsByOrder = new Map<string, OrderItem[]>();
  for (const item of itemRows) {
    const current = itemsByOrder.get(item.orderId) || [];
    current.push({
      itemId: item.productId || item.id,
      name: item.name,
      price: Number(item.price),
      quantity: item.quantity,
    });
    itemsByOrder.set(item.orderId, current);
  }

  return orderRows.map((order) => ({
    id: order.id,
    tableId: order.tableId || "",
    sessionId: order.sessionId || undefined,
    customerName: order.customerName,
    notes: order.notes || "",
    items: itemsByOrder.get(order.id) || [],
    total: Number(order.total),
    status: order.status as OrderStatus,
    createdAt: toIsoString(order.createdAt),
  }));
}

export async function validateTableSessionInDb(
  tableId: string,
  sessionId?: string,
): Promise<TableSessionValidation> {
  const normalizedTableId = tableId.trim();
  if (!normalizedTableId) {
    return { allowed: true };
  }

  const normalizedSessionId = String(sessionId ?? "").trim();
  if (!normalizedSessionId) {
    return { allowed: false, reason: "missing-session" };
  }

  const activeSession = await db.query.tableSessions.findFirst({
    where: and(eq(tableSessions.tableId, normalizedTableId), eq(tableSessions.status, "active")),
  });

  if (activeSession) {
    if (activeSession.sessionId !== normalizedSessionId) {
      return { allowed: false, reason: "table-in-use" };
    }
    return { allowed: true };
  }

  const closedSession = await db.query.tableSessions.findFirst({
    where: and(
      eq(tableSessions.tableId, normalizedTableId),
      eq(tableSessions.sessionId, normalizedSessionId),
      eq(tableSessions.status, "closed"),
    ),
  });

  if (closedSession) {
    return { allowed: false, reason: "session-closed" };
  }

  await db.insert(tableSessions).values({
    tableId: normalizedTableId,
    sessionId: normalizedSessionId,
    status: "active",
  });

  return { allowed: true };
}

export async function createOrderInDb(input: CreateOrderInput): Promise<Order> {
  const [newOrder] = await db
    .insert(orders)
    .values({
      tableId: input.tableId || null,
      sessionId: input.sessionId || null,
      customerName: input.customerName,
      notes: input.notes || null,
      total: String(input.total),
      status: "novo",
    })
    .returning();

  await db.insert(orderItems).values(
    input.items.map((item) => ({
      orderId: newOrder.id,
      productId: item.itemId || null,
      name: item.name,
      price: String(item.price),
      quantity: item.quantity,
    })),
  );

  await Promise.all(
    input.items.map((item) =>
      db
        .update(products)
        .set({ stock: sql`GREATEST(${products.stock} - ${item.quantity}, 0)` })
        .where(eq(products.id, item.itemId)),
    ),
  );

  return {
    id: newOrder.id,
    tableId: newOrder.tableId || "",
    sessionId: newOrder.sessionId || undefined,
    customerName: newOrder.customerName,
    notes: newOrder.notes || "",
    items: input.items,
    total: Number(newOrder.total),
    status: newOrder.status as OrderStatus,
    createdAt: toIsoString(newOrder.createdAt),
  };
}

export async function updateOrderStatusInDb(id: string, status: OrderStatus): Promise<Order | null> {
  const [updated] = await db.update(orders).set({ status }).where(eq(orders.id, id)).returning();
  if (!updated) {
    return null;
  }

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
  return {
    id: updated.id,
    tableId: updated.tableId || "",
    sessionId: updated.sessionId || undefined,
    customerName: updated.customerName,
    notes: updated.notes || "",
    items: items.map((item) => ({
      itemId: item.productId || item.id,
      name: item.name,
      price: Number(item.price),
      quantity: item.quantity,
    })),
    total: Number(updated.total),
    status: updated.status as OrderStatus,
    createdAt: toIsoString(updated.createdAt),
  };
}

export async function closeTableWithPaymentInDb(tableId: string, method: PaymentMethod) {
  const normalizedTableId = tableId.trim();
  const activeSession = await db.query.tableSessions.findFirst({
    where: and(eq(tableSessions.tableId, normalizedTableId), eq(tableSessions.status, "active")),
  });

  if (!activeSession) {
    return { closedOrders: 0, total: 0, payment: null as PaymentRecord | null, receipt: null as TableReceipt | null };
  }

  const activeOrders = await db
    .select()
    .from(orders)
    .where(and(eq(orders.tableId, normalizedTableId), eq(orders.sessionId, activeSession.sessionId)));

  const total = activeOrders.reduce((acc, order) => acc + Number(order.total), 0);

  if (activeOrders.length === 0 || total <= 0) {
    await db
      .update(tableSessions)
      .set({ status: "closed", closedAt: new Date() })
      .where(eq(tableSessions.id, activeSession.id));
    return { closedOrders: 0, total: 0, payment: null as PaymentRecord | null, receipt: null as TableReceipt | null };
  }

  const activeOrderIds = activeOrders.map((order) => order.id);
  const consumedItems = await db.select().from(orderItems).where(inArray(orderItems.orderId, activeOrderIds));

  const aggregated = new Map<string, ReceiptLineItem>();
  for (const item of consumedItems) {
    const unitPrice = Number(item.price);
    const key = `${item.name}::${unitPrice.toFixed(2)}`;
    const current = aggregated.get(key);
    if (current) {
      current.quantity += item.quantity;
      current.total += unitPrice * item.quantity;
      continue;
    }

    aggregated.set(key, {
      description: item.name,
      quantity: item.quantity,
      unitPrice,
      total: unitPrice * item.quantity,
    });
  }

  const lines = Array.from(aggregated.values()).sort((a, b) => a.description.localeCompare(b.description, "pt-BR"));

  await db.update(orders).set({ status: "entregue" }).where(inArray(orders.id, activeOrderIds));

  const [payment] = await db
    .insert(payments)
    .values({
      tableId: normalizedTableId,
      amount: String(total),
      method,
    })
    .returning();

  await db
    .update(tableSessions)
    .set({ status: "closed", closedAt: new Date() })
    .where(eq(tableSessions.id, activeSession.id));

  const receipt: TableReceipt = {
    tableId: normalizedTableId,
    sessionId: activeSession.sessionId,
    method,
    total,
    closedAt: toIsoString(payment.closedAt),
    orderCount: activeOrders.length,
    lines,
  };

  return {
    closedOrders: activeOrders.length,
    total,
    payment: {
      id: payment.id,
      tableId: payment.tableId,
      amount: Number(payment.amount),
      method: payment.method as PaymentMethod,
      closedAt: toIsoString(payment.closedAt),
    },
    receipt,
  };
}

export async function listPaymentsFromDb(): Promise<PaymentRecord[]> {
  const rows = await db.select().from(payments).orderBy(desc(payments.closedAt));
  return rows.map((payment) => ({
    id: payment.id,
    tableId: payment.tableId,
    amount: Number(payment.amount),
    method: payment.method as PaymentMethod,
    closedAt: toIsoString(payment.closedAt),
  }));
}

export async function listActiveTableSummariesFromDb(): Promise<ActiveTableSummary[]> {
  const activeSessions = await db
    .select()
    .from(tableSessions)
    .where(eq(tableSessions.status, "active"));

  if (activeSessions.length === 0) {
    return [];
  }

  const allOrders = await listOrdersFromDb();

  return activeSessions
    .map((session) => {
      const sessionOrders = allOrders.filter(
        (order) => order.tableId === session.tableId && order.sessionId === session.sessionId,
      );

      if (sessionOrders.length === 0) {
        return null;
      }

      return {
        tableId: session.tableId,
        total: sessionOrders.reduce((acc, order) => acc + order.total, 0),
        count: sessionOrders.length,
        orders: sessionOrders,
      };
    })
    .filter((summary): summary is ActiveTableSummary => summary !== null)
    .sort((a, b) => a.tableId.localeCompare(b.tableId, "pt-BR", { numeric: true }));
}