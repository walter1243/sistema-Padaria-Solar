import { NextResponse } from "next/server";

const COOKIE_NAME = "padaria_admin_session";

function getCredentials() {
  return {
    username: process.env.ADMIN_USERNAME || "admin",
    password: process.env.ADMIN_PASSWORD || "123456",
    sessionToken: process.env.ADMIN_SESSION_TOKEN || "padaria_admin_token_dev",
  };
}

export async function POST(request: Request) {
  const body = await request.json();
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "").trim();

  const creds = getCredentials();
  const isValid = username.toLowerCase() === creds.username.toLowerCase() && password === creds.password;

  if (!isValid) {
    return NextResponse.json({ error: "Usuario ou senha invalidos." }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(COOKIE_NAME, creds.sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
