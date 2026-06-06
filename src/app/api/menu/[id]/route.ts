import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { products, categories, addons, orderItems } from "@/lib/db/schema";
import { eq, ilike } from "drizzle-orm";
import { UnitMeasure } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

function getDbErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "Erro de banco de dados.");
  }
  return "Erro de banco de dados.";
}

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json();

  const name = body.name ? String(body.name).trim() : undefined;
  const description = body.description ? String(body.description).trim() : undefined;
  const price = typeof body.price === "number" ? body.price : undefined;
  const categoryName = body.category ? String(body.category).trim() : undefined;
  const unit: UnitMeasure | undefined = body.unit;
  const imageUrl = body.imageUrl ? String(body.imageUrl).trim() : undefined;
  const available = typeof body.available === "boolean" ? body.available : undefined;

  // Resolve category ID se o nome foi enviado
  let categoryId: string | undefined;
  if (categoryName) {
    let [cat] = await db
      .select()
      .from(categories)
      .where(ilike(categories.name, categoryName))
      .limit(1);
    if (!cat) {
      [cat] = await db.insert(categories).values({ name: categoryName }).returning();
    }
    categoryId = cat.id;
  }

  const patch: Record<string, unknown> = {};
  if (name !== undefined) patch.name = name;
  if (description !== undefined) patch.description = description;
  if (price !== undefined) patch.price = String(price);
  if (categoryId !== undefined) patch.categoryId = categoryId;
  if (unit !== undefined) patch.unit = unit;
  if (imageUrl !== undefined) patch.imageUrl = imageUrl;
  if (available !== undefined) patch.available = available;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nenhum campo para atualizar." }, { status: 400 });
  }

  let updated;
  try {
    [updated] = await db
      .update(products)
      .set(patch)
      .where(eq(products.id, id))
      .returning();
  } catch (error) {
    return NextResponse.json(
      { error: `Falha ao atualizar produto no banco: ${getDbErrorMessage(error)}` },
      { status: 500 }
    );
  }

  if (!updated) {
    return NextResponse.json(
      { error: "Produto nao encontrado no banco de dados. Verifique se o produto foi cadastrado corretamente." },
      { status: 404 }
    );
  }

  // Atualiza addons se enviados
  if (Array.isArray(body.addons)) {
    try {
      await db.delete(addons).where(eq(addons.productId, id));

      const safeAddons = body.addons
        .filter((a: unknown): a is Record<string, unknown> => typeof a === "object" && a !== null)
        .map((a: Record<string, unknown>) => ({
          productId: id,
          name: String(a.name ?? "").trim(),
          price: String(Number(a.price ?? 0)),
          description: String(a.description ?? "").trim(),
        }))
        .filter((a: { productId: string; name: string; price: string; description: string }) => a.name.length > 0);

      if (safeAddons.length > 0) {
        await db.insert(addons).values(safeAddons);
      }
    } catch (error) {
      return NextResponse.json(
        { error: `Produto atualizado, mas falhou ao salvar acompanhamentos: ${getDbErrorMessage(error)}` },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ...updated, price: Number(updated.price) });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;

  let removed;
  try {
    // Mantem historico de pedidos: remove apenas o vinculo ao produto antes da exclusao fisica.
    await db.update(orderItems).set({ productId: null }).where(eq(orderItems.productId, id));

    [removed] = await db
      .delete(products)
      .where(eq(products.id, id))
      .returning();
  } catch (error) {
    const message = getDbErrorMessage(error);
    const isForeignKeyError = message.toLowerCase().includes("violates foreign key constraint");

    if (isForeignKeyError) {
      return NextResponse.json(
        {
          error:
            "Nao foi possivel excluir este produto porque ele ja foi usado em pedidos. Exclua os pedidos relacionados ou inative o produto.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: `Falha ao excluir produto do banco: ${message}` },
      { status: 500 }
    );
  }

  if (!removed) {
    return NextResponse.json(
      { error: "Produto nao encontrado no banco de dados. Pode ter sido removido anteriormente." },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
