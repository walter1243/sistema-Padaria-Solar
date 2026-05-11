import { NextResponse } from "next/server";
import { addOrder, listOrders, validateTableSession } from "@/lib/store";

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

  const created = addOrder({
    tableId,
    sessionId,
    customerName,
    notes,
    items: safeItems,
    total,
  });

  return NextResponse.json(created, { status: 201 });
}
