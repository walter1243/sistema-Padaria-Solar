import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminCredentials, updateAdminCredentials } from "@/lib/db/admin";

const COOKIE_NAME = "padaria_admin_session";

function isAdminCookieValid(cookieValue: string | undefined) {
  const expected = process.env.ADMIN_SESSION_TOKEN || "padaria_admin_token_dev";
  return Boolean(cookieValue && cookieValue === expected);
}

export async function GET() {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get(COOKIE_NAME)?.value;

  if (!isAdminCookieValid(adminCookie)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  const admin = await getAdminCredentials();
  return NextResponse.json({ username: admin.username });
}

export async function PUT(request: Request) {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get(COOKIE_NAME)?.value;

  if (!isAdminCookieValid(adminCookie)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  const body = await request.json();
  const username = String(body.username ?? "").trim();
  const currentPassword = String(body.currentPassword ?? "");
  const newPassword = String(body.newPassword ?? "");

  if (!username || !currentPassword || !newPassword) {
    return NextResponse.json({ error: "Usuario, senha atual e nova senha sao obrigatorios." }, { status: 400 });
  }

  if (newPassword.length < 6) {
    return NextResponse.json({ error: "A nova senha deve ter pelo menos 6 caracteres." }, { status: 400 });
  }

  const current = await getAdminCredentials();
  if (current.password !== currentPassword) {
    return NextResponse.json({ error: "A senha atual informada esta incorreta." }, { status: 401 });
  }

  const updated = await updateAdminCredentials({ username, password: newPassword });
  return NextResponse.json({ username: updated.username });
}