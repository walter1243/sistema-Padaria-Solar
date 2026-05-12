import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { categories, products } from "@/lib/db/schema";
import { eq, asc, sql } from "drizzle-orm";

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
    .where(sql`lower(${categories.name}) = lower(${name})`)
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

  if (!name) {
    return NextResponse.json({ error: "Nome da categoria invalido." }, { status: 400 });
  }

  const [cat] = await db
    .select()
    .from(categories)
    .where(sql`lower(${categories.name}) = lower(${name})`)
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

  const deleted = await db.delete(categories).where(eq(categories.id, cat.id)).returning({ id: categories.id, name: categories.name });
  if (deleted.length === 0) {
    return NextResponse.json({ error: "Categoria nao foi removida do banco. Tente novamente." }, { status: 500 });
  }

  return NextResponse.json({ success: true, category: deleted[0].name });
}

export async function PUT(request: Request) {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("padaria_admin_session")?.value;

  if (!isAdminCookieValid(adminCookie)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  const body = await request.json();
  const previousName = String(body.previousName ?? "").trim();
  const nextName = String(body.nextName ?? "").trim();

  if (!previousName || !nextName) {
    return NextResponse.json({ error: "Nome atual e novo nome sao obrigatorios." }, { status: 400 });
  }

  const [cat] = await db
    .select()
    .from(categories)
    .where(sql`lower(${categories.name}) = lower(${previousName})`)
    .limit(1);

  if (!cat) {
    return NextResponse.json({ error: "Categoria nao encontrada no banco de dados." }, { status: 404 });
  }

  const [updated] = await db
    .update(categories)
    .set({ name: nextName })
    .where(eq(categories.id, cat.id))
    .returning({ id: categories.id, name: categories.name });

  if (!updated) {
    return NextResponse.json({ error: "Nao foi possivel atualizar a categoria." }, { status: 500 });
  }

  return NextResponse.json({ category: updated.name });
}
