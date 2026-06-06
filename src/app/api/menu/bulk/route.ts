import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { products, categories } from "@/lib/db/schema";
import { ilike } from "drizzle-orm";
import { UnitMeasure } from "@/lib/types";

const MAX_NAME_LENGTH = 200;
const MAX_CATEGORY_LENGTH = 100;

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

function normalizePrice(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const normalized = raw.replace(/\s/g, "").replace(/R\$/gi, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeUnit(value: unknown): UnitMeasure {
  const unit = String(value ?? "").trim().toLowerCase();
  const validUnits: UnitMeasure[] = ["un", "kg", "g", "l", "ml"];
  return validUnits.includes(unit as UnitMeasure) ? (unit as UnitMeasure) : "un";
}

function formatDbError(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "Erro no banco.");
  }
  return String(error);
}

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

  const results: { name: string; ok: boolean; error?: string }[] = [];
  const categoryCache = new Map<string, string>();

  for (const item of items) {
    const rawName = String(item.name ?? "").trim();
    const name = rawName.slice(0, MAX_NAME_LENGTH);
    const description = (String(item.description ?? "").trim() || name).slice(0, 500);
    const price = normalizePrice(item.price);
    const categoryName = String(item.category ?? "").trim().slice(0, MAX_CATEGORY_LENGTH);
    const unit = normalizeUnit(item.unit);
    const imageUrl = String(item.imageUrl ?? "").trim();

    if (!name || !categoryName || price <= 0) {
      results.push({
        name: name || "(sem nome)",
        ok: false,
        error: "Dados invalidos (nome/categoria/preco).",
      });
      continue;
    }

    try {
      const cacheKey = categoryName.toLowerCase();
      let categoryId = categoryCache.get(cacheKey);

      if (!categoryId) {
        let [cat] = await db.select().from(categories).where(ilike(categories.name, categoryName)).limit(1);
        if (!cat) {
          try {
            [cat] = await db.insert(categories).values({ name: categoryName }).returning();
          } catch {
            // In concorrencia, outra insercao pode vencer. Reconsulta para reaproveitar a categoria criada.
            [cat] = await db.select().from(categories).where(ilike(categories.name, categoryName)).limit(1);
          }
        }

        if (!cat) {
          results.push({ name, ok: false, error: "Nao foi possivel resolver a categoria." });
          continue;
        }

        categoryId = cat.id;
        categoryCache.set(cacheKey, categoryId);
      }

      const [newProduct] = await db
        .insert(products)
        .values({
          name,
          description,
          price: String(price),
          categoryId,
          unit,
          imageUrl: imageUrl || "",
          available: Boolean(item.available ?? true),
          stock: 0,
        })
        .returning();

      results.push({ name: newProduct.name, ok: true });
    } catch (e) {
      results.push({ name, ok: false, error: formatDbError(e) });
    }
  }

  const success = results.filter((r) => r.ok).length;
  const errors = results.filter((r) => !r.ok).length;

  return NextResponse.json({ success, errors, results });
}
