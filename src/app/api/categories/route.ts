import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { categories, products } from "@/lib/db/schema";
import { eq, ilike, asc } from "drizzle-orm";

function isAdminCookieValid(cookieValue: string | undefined) {
  const expected = process.env.ADMIN_SESSION_TOKEN || "padaria_admin_token_dev";
  return Boolean(cookieValue && cookieValue === expected);
}

export async function GET() {
  const rows = await db.select({ name: categories.name }).from(categories).orderBy(asc(categories.name));
  return NextResponse.json(rows.map((r) => r.name));
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("padaria_admin_session")?.value;

  if (!isAdminCookieValid(adminCookie)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  const body = await request.json();
  const name = String(body.name ?? "").trim();

  if (!name) {
    return NextResponse.json({ error: "Nome da categoria invalido." }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(categories)
    .where(ilike(categories.name, name))
    .limit(1);

  if (existing) {
    return NextResponse.json({ category: existing.name }, { status: 200 });
  }

  const [created] = await db.insert(categories).values({ name }).returning();
  return NextResponse.json({ category: created.name }, { status: 201 });
}

export async function DELETE(request: Request) {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("padaria_admin_session")?.value;

  if (!isAdminCookieValid(adminCookie)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  const body = await request.json();
  const name = String(body.name ?? "").trim();

  const [cat] = await db
    .select()
    .from(categories)
    .where(ilike(categories.name, name))
    .limit(1);

  if (!cat) {
    return NextResponse.json({ error: "Categoria nao encontrada no banco de dados." }, { status: 404 });
  }

  const [usedBy] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.categoryId, cat.id))
    .limit(1);

  if (usedBy) {
    return NextResponse.json(
      { error: "Categoria em uso por produtos cadastrados. Remova ou reatribua os produtos antes de excluir a categoria." },
      { status: 409 }
    );
  }

  await db.delete(categories).where(eq(categories.id, cat.id));
  return NextResponse.json({ success: true });
}
