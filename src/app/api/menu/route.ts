import { NextResponse } from "next/server";
import { UnitMeasure } from "@/lib/types";
import { db } from "@/lib/db";
import { products, categories, addons } from "@/lib/db/schema";
import { eq, ilike, asc, inArray } from "drizzle-orm";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const categoryFilter = searchParams.get("category");

  const query = db
    .select({
      id: products.id,
      name: products.name,
      description: products.description,
      price: products.price,
      stock: products.stock,
      unit: products.unit,
      imageUrl: products.imageUrl,
      available: products.available,
      category: categories.name,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .orderBy(asc(products.name));

  const rows = categoryFilter
    ? await query.where(ilike(categories.name, categoryFilter))
    : await query;

  // Busca addons de todos os produtos retornados
  const productIds = rows.map((r) => r.id);
  const allAddons =
    productIds.length > 0
      ? await db
          .select()
          .from(addons)
          .where(
            productIds.length === 1
              ? eq(addons.productId, productIds[0])
              : inArray(addons.productId, productIds)
          )
      : [];

  const addonsByProduct: Record<string, typeof allAddons> = {};
  for (const addon of allAddons) {
    if (!addonsByProduct[addon.productId]) addonsByProduct[addon.productId] = [];
    addonsByProduct[addon.productId].push(addon);
  }

  const result = rows.map((row) => ({
    ...row,
    price: Number(row.price),
    addons: (addonsByProduct[row.id] || []).map((a) => ({
      name: a.name,
      price: Number(a.price),
      description: a.description ?? "",
    })),
  }));

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const body = await request.json();

  const name = String(body.name ?? "").trim();
  const description = String(body.description ?? "").trim();
  const price = Number(body.price ?? 0);
  const categoryName = String(body.category ?? "").trim();
  const unit = body.unit as UnitMeasure;
  const imageUrl = String(body.imageUrl ?? "").trim();
  const available = Boolean(body.available ?? true);
  const rawAddons: unknown[] = Array.isArray(body.addons) ? body.addons : [];

  const validUnits: UnitMeasure[] = ["un", "kg", "g", "l", "ml"];

  if (!name || !description || !imageUrl || !categoryName || price <= 0 || !validUnits.includes(unit)) {
    return NextResponse.json({ error: "Dados invalidos para criar item." }, { status: 400 });
  }

  // Garante que a categoria existe no banco
  let [cat] = await db
    .select()
    .from(categories)
    .where(ilike(categories.name, categoryName))
    .limit(1);

  if (!cat) {
    [cat] = await db.insert(categories).values({ name: categoryName }).returning();
  }

  const [newProduct] = await db
    .insert(products)
    .values({
      name,
      description,
      price: String(price),
      categoryId: cat.id,
      unit,
      imageUrl,
      available,
      stock: 0,
    })
    .returning();

  const safeAddons = rawAddons
    .filter((a): a is Record<string, unknown> => typeof a === "object" && a !== null)
    .map((a) => ({
      productId: newProduct.id,
      name: String(a.name ?? "").trim(),
      price: String(Number(a.price ?? 0)),
      description: String(a.description ?? "").trim(),
    }))
    .filter((a) => a.name.length > 0);

  if (safeAddons.length > 0) {
    await db.insert(addons).values(safeAddons);
  }

  return NextResponse.json(
    {
      id: newProduct.id,
      name: newProduct.name,
      description: newProduct.description,
      price: Number(newProduct.price),
      stock: newProduct.stock,
      category: categoryName,
      unit: newProduct.unit,
      imageUrl: newProduct.imageUrl,
      available: newProduct.available,
      addons: safeAddons.map((a) => ({ name: a.name, price: Number(a.price), description: a.description })),
    },
    { status: 201 }
  );
}
