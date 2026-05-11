import { NextResponse } from "next/server";
import { addMenuItem, listMenu } from "@/lib/store";
import { UnitMeasure, Addon } from "@/lib/types";

export async function GET() {
  return NextResponse.json(listMenu());
}

export async function POST(request: Request) {
  const body = await request.json();
  const rawAddons: unknown[] = Array.isArray(body.addons) ? body.addons : [];
  const addons = rawAddons
    .map((addon: any) => {
      if (typeof addon === "object" && addon !== null) {
        return {
          name: String(addon.name ?? "").trim(),
          price: Number(addon.price ?? 0),
          description: String(addon.description ?? "").trim(),
        } as Addon;
      }
      return null;
    })
    .filter((addon: Addon | null): addon is Addon => addon !== null && addon.name.length > 0);

  const payload = {
    name: String(body.name ?? "").trim(),
    description: String(body.description ?? "").trim(),
    price: Number(body.price ?? 0),
    category: String(body.category ?? "").trim(),
    unit: body.unit as UnitMeasure,
    imageUrl: String(body.imageUrl ?? "").trim(),
    available: Boolean(body.available ?? true),
    addons,
  };

  const validUnits: UnitMeasure[] = ["un", "kg", "g", "l", "ml"];

  if (
    !payload.name ||
    !payload.description ||
    !payload.imageUrl ||
    !payload.category ||
    payload.price <= 0 ||
    !validUnits.includes(payload.unit)
  ) {
    return NextResponse.json({ error: "Dados invalidos para criar item." }, { status: 400 });
  }

  const created = addMenuItem(payload);
  return NextResponse.json(created, { status: 201 });
}
