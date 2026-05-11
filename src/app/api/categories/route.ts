import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { addCategory, deleteCategory, listCategories } from "@/lib/store";

function isAdminCookieValid(cookieValue: string | undefined) {
  const expected = process.env.ADMIN_SESSION_TOKEN || "padaria_admin_token_dev";
  return Boolean(cookieValue && cookieValue === expected);
}

export async function GET() {
  return NextResponse.json(listCategories());
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("padaria_admin_session")?.value;

  if (!isAdminCookieValid(adminCookie)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  const body = await request.json();
  const category = addCategory(String(body.name ?? ""));

  if (!category) {
    return NextResponse.json({ error: "Categoria invalida." }, { status: 400 });
  }

  return NextResponse.json({ category }, { status: 201 });
}

export async function DELETE(request: Request) {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("padaria_admin_session")?.value;

  if (!isAdminCookieValid(adminCookie)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  const body = await request.json();
  const result = deleteCategory(String(body.name ?? ""));

  if (!result.removed && result.reason === "used") {
    return NextResponse.json({ error: "Categoria em uso por produtos cadastrados." }, { status: 409 });
  }

  if (!result.removed) {
    return NextResponse.json({ error: "Categoria nao encontrada." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
