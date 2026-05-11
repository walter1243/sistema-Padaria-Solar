import { NextResponse } from "next/server";
import { deleteMenuItem, updateMenuItem } from "@/lib/store";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json();

  const updated = updateMenuItem(id, {
    name: body.name,
    description: body.description,
    price: body.price,
    category: body.category,
    imageUrl: body.imageUrl,
    available: body.available,
  });

  if (!updated) {
    return NextResponse.json({ error: "Item nao encontrado." }, { status: 404 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const removed = deleteMenuItem(id);

  if (!removed) {
    return NextResponse.json({ error: "Item nao encontrado." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
