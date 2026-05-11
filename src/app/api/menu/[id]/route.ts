import { NextResponse } from "next/server";
import { deleteMenuItem, updateMenuItem } from "@/lib/store";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const addons = Array.isArray(body.addons)
    ? body.addons
        .map((value: unknown) => String(value ?? "").trim())
        .filter((value: string) => value.length > 0)
    : undefined;

  const updated = updateMenuItem(id, {
    name: body.name ? String(body.name).trim() : undefined,
    description: body.description ? String(body.description).trim() : undefined,
    price: typeof body.price === "number" ? body.price : undefined,
    category: body.category ? String(body.category).trim() : undefined,
    unit: body.unit,
    imageUrl: body.imageUrl ? String(body.imageUrl).trim() : undefined,
    available: typeof body.available === "boolean" ? body.available : undefined,
    addons,
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
