import { NextResponse } from "next/server";
import { updateOrderStatusInDb } from "@/lib/db/orders";
import { OrderStatus } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

const validStatus: OrderStatus[] = ["novo", "preparando", "pronto", "entregue"];

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const status = body.status as OrderStatus;

  if (!validStatus.includes(status)) {
    return NextResponse.json({ error: "Status invalido." }, { status: 400 });
  }

  const updated = await updateOrderStatusInDb(id, status);

  if (!updated) {
    return NextResponse.json({ error: "Pedido nao encontrado." }, { status: 404 });
  }

  return NextResponse.json(updated);
}
