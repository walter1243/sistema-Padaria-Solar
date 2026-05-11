import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getBakerUser, updateBakerUser } from "@/lib/store";

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

  const baker = getBakerUser();
  return NextResponse.json({ username: baker.username });
}

export async function PUT(request: Request) {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("padaria_admin_session")?.value;

  if (!isAdminCookieValid(adminCookie)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  const body = await request.json();
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");

  if (!username || !password) {
    return NextResponse.json({ error: "Usuario e senha do padeiro sao obrigatorios." }, { status: 400 });
  }

  const updated = updateBakerUser({ username, password });
  return NextResponse.json({ username: updated.username });
}
