import { NextResponse } from "next/server";
import { addMenuItem, listMenu } from "@/lib/store";
import { MenuCategory } from "@/lib/types";

export async function GET() {
  return NextResponse.json(listMenu());
}

export async function POST(request: Request) {
  const body = await request.json();
  const rawAddons: unknown[] = Array.isArray(body.addons) ? body.addons : [];
  const addons = rawAddons
    .map((value: unknown) => String(value ?? "").trim())
    .filter((value: string) => value.length > 0);

  const payload = {
    name: String(body.name ?? "").trim(),
    description: String(body.description ?? "").trim(),
    price: Number(body.price ?? 0),
    category: body.category as MenuCategory,
    imageUrl: String(body.imageUrl ?? "").trim(),
    available: Boolean(body.available ?? true),
    addons,
  };

  if (!payload.name || !payload.description || !payload.imageUrl || payload.price <= 0) {
    return NextResponse.json({ error: "Dados invalidos para criar item." }, { status: 400 });
  }

  const created = addMenuItem(payload);
  return NextResponse.json(created, { status: 201 });
}
