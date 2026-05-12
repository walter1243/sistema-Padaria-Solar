import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { listPaymentsFromDb } from "@/lib/db/orders";

function isAdminCookieValid(cookieValue: string | undefined) {
  const expected = process.env.ADMIN_SESSION_TOKEN || "padaria_admin_token_dev";
  return Boolean(cookieValue && cookieValue === expected);
}

export async function GET() {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("padaria_admin_session")?.value;

  if (!isAdminCookieValid(adminCookie)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  const payments = await listPaymentsFromDb();
  const totalsByMethod = {
    dinheiro: payments.filter((item) => item.method === "dinheiro").reduce((acc, item) => acc + item.amount, 0),
    pix: payments.filter((item) => item.method === "pix").reduce((acc, item) => acc + item.amount, 0),
    cartao: payments.filter((item) => item.method === "cartao").reduce((acc, item) => acc + item.amount, 0),
  };

  const totalPaid = totalsByMethod.dinheiro + totalsByMethod.pix + totalsByMethod.cartao;

  return NextResponse.json({
    totalPaid,
    totalsByMethod,
    payments,
  });
}
