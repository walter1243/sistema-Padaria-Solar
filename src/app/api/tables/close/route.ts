import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { closeTableWithPayment } from "@/lib/store";
import { PaymentMethod } from "@/lib/types";

function isAdminCookieValid(cookieValue: string | undefined) {
  const expected = process.env.ADMIN_SESSION_TOKEN || "padaria_admin_token_dev";
  return Boolean(cookieValue && cookieValue === expected);
}

const validMethods: PaymentMethod[] = ["dinheiro", "pix", "cartao"];

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("padaria_admin_session")?.value;

  if (!isAdminCookieValid(adminCookie)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  const body = await request.json();
  const tableId = String(body.tableId ?? "").trim();
  const method = String(body.method ?? "") as PaymentMethod;

  if (!tableId || !validMethods.includes(method)) {
    return NextResponse.json({ error: "Dados invalidos para fechamento da mesa." }, { status: 400 });
  }

  const result = closeTableWithPayment(tableId, method);

  if (result.closedOrders === 0) {
    return NextResponse.json({ error: "Mesa sem pedidos ativos para fechamento." }, { status: 409 });
  }

  return NextResponse.json(result);
}
