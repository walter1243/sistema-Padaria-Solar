import { NextResponse } from "next/server";
import { addOrder, listOrders } from "@/lib/store";

export async function GET() {
  return NextResponse.json(listOrders());
}

export async function POST(request: Request) {
  const body = await request.json();

  const customerName = String(body.customerName ?? "").trim();
  const notes = String(body.notes ?? "").trim();
  const items = Array.isArray(body.items) ? body.items : [];

  if (!customerName || items.length === 0) {
    return NextResponse.json({ error: "Pedido invalido." }, { status: 400 });
  }

  const safeItems = items.map((item) => ({
    itemId: String(item.itemId),
    name: String(item.name),
    price: Number(item.price),
    quantity: Number(item.quantity),
  }));

  const total = safeItems.reduce((acc, item) => acc + item.price * item.quantity, 0);

  const created = addOrder({
    customerName,
    notes,
    items: safeItems,
    total,
  });

  return NextResponse.json(created, { status: 201 });
}
