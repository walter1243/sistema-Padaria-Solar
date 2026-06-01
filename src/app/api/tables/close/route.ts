import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { releaseTableInDb } from "@/lib/db/orders";

function isAdminCookieValid(cookieValue: string | undefined) {
  const expected = process.env.ADMIN_SESSION_TOKEN || "padaria_admin_token_dev";
  return Boolean(cookieValue && cookieValue === expected);
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("padaria_admin_session")?.value;

  if (!isAdminCookieValid(adminCookie)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  const body = await request.json();
  const tableId = String(body.tableId ?? "").trim();

  if (!tableId) {
    return NextResponse.json({ error: "Dados invalidos para liberar a mesa." }, { status: 400 });
  }

  const result = await releaseTableInDb(tableId);
  return NextResponse.json(result);
}
