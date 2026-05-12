import { NextResponse } from "next/server";
import { addOrder, listOrders, validateTableSession } from "@/lib/store";
import { db } from "@/lib/db";
import { orders, orderItems, products } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

type RawOrderItem = {
  itemId?: unknown;
  name?: unknown;
  price?: unknown;
  quantity?: unknown;
};

export async function GET() {
  return NextResponse.json(listOrders());
}

export async function POST(request: Request) {
  const body = await request.json();

  const customerName = String(body.customerName ?? "").trim();
  const tableId = String(body.tableId ?? "").trim();
  const sessionId = String(body.sessionId ?? "").trim();
  const notes = String(body.notes ?? "").trim();
  const items: RawOrderItem[] = Array.isArray(body.items) ? body.items : [];

  if (!customerName || items.length === 0) {
    return NextResponse.json({ error: "Pedido invalido." }, { status: 400 });
  }

  const safeItems = items.map((item: RawOrderItem) => ({
    itemId: String(item.itemId),
    name: String(item.name),
    price: Number(item.price),
    quantity: Number(item.quantity),
  }));

  const total = safeItems.reduce((acc, item) => acc + item.price * item.quantity, 0);

  const sessionValidation = validateTableSession(tableId, sessionId);
  if (!sessionValidation.allowed) {
    if (sessionValidation.reason === "missing-session") {
      return NextResponse.json({ error: "Sessao da mesa invalida. Reabra o cardapio pelo QR Code." }, { status: 400 });
    }
    if (sessionValidation.reason === "session-closed") {
      return NextResponse.json({ error: "Esta sessao ja foi encerrada. Escaneie o QR Code novamente." }, { status: 409 });
    }
    return NextResponse.json({ error: "Mesa em uso por outra sessao." }, { status: 409 });
  }

  // Persiste o pedido no banco e reduz estoque
  const [newOrder] = await db
    .insert(orders)
    .values({
      tableId: tableId || null,
      sessionId: sessionId || null,
      customerName,
      notes: notes || null,
      total: String(total),
      status: "novo",
    })
    .returning();

  await db.insert(orderItems).values(
    safeItems.map((item) => ({
      orderId: newOrder.id,
      productId: item.itemId || null,
      name: item.name,
      price: String(item.price),
      quantity: item.quantity,
    }))
  );

  // Reduz estoque de cada produto vendido
  await Promise.all(
    safeItems.map((item) =>
      db
        .update(products)
        .set({ stock: sql`GREATEST(${products.stock} - ${item.quantity}, 0)` })
        .where(eq(products.id, item.itemId))
    )
  );

  // Mantém também na store em memória para compatibilidade com cozinha/admin
  const created = addOrder({
    tableId,
    sessionId,
    customerName,
    notes,
    items: safeItems,
    total,
  });

  return NextResponse.json({ ...created, dbId: newOrder.id }, { status: 201 });
}
