import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { products, categories, addons } from "@/lib/db/schema";
import { ilike } from "drizzle-orm";
import { UnitMeasure } from "@/lib/types";

function isAdminCookieValid(cookieValue: string | undefined) {
  const expected = process.env.ADMIN_SESSION_TOKEN || "padaria_admin_token_dev";
  return Boolean(cookieValue && cookieValue === expected);
}

type BulkProduct = {
  name: string;
  description: string;
  price: number;
  category: string;
  unit: string;
  imageUrl: string;
  available: boolean;
};

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("padaria_admin_session")?.value;

  if (!isAdminCookieValid(adminCookie)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  const body = await request.json();
  const items: BulkProduct[] = Array.isArray(body.products) ? body.products : [];

  if (items.length === 0) {
    return NextResponse.json({ error: "Lista de produtos vazia." }, { status: 400 });
  }

  const validUnits: UnitMeasure[] = ["un", "kg", "g", "l", "ml"];
  const results: { name: string; ok: boolean; error?: string }[] = [];

  for (const item of items) {
    const name = String(item.name ?? "").trim();
    const description = String(item.description ?? "").trim() || name;
    const price = Number(item.price ?? 0);
    const categoryName = String(item.category ?? "").trim();
    const unit = (validUnits.includes(item.unit as UnitMeasure) ? item.unit : "un") as UnitMeasure;
    const imageUrl = String(item.imageUrl ?? "").trim();

    if (!name || !categoryName || price <= 0) {
      results.push({ name: name || "(sem nome)", ok: false, error: "Dados invalidos" });
      continue;
    }

    try {
      // Ensure category exists
      let [cat] = await db.select().from(categories).where(ilike(categories.name, categoryName)).limit(1);
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
          imageUrl: imageUrl || "",
          available: Boolean(item.available ?? true),
          stock: 0,
        })
        .returning();

      results.push({ name: newProduct.name, ok: true });
    } catch (e) {
      results.push({ name, ok: false, error: String(e) });
    }
  }

  const success = results.filter((r) => r.ok).length;
  const errors = results.filter((r) => !r.ok).length;

  return NextResponse.json({ success, errors, results });
}
