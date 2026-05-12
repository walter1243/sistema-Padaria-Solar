import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { listActiveTableSummariesFromDb } from "@/lib/db/orders";

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

  return NextResponse.json(await listActiveTableSummariesFromDb());
}