import { NextResponse } from "next/server";
import { getBakerUser } from "@/lib/store";

const COOKIE_NAME = "padaria_kitchen_session";

function getSessionToken() {
  return process.env.KITCHEN_SESSION_TOKEN || "padaria_kitchen_token_dev";
}

export async function POST(request: Request) {
  const body = await request.json();
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "").trim();

  const baker = getBakerUser();
  const isValid = username.toLowerCase() === baker.username.toLowerCase() && password === baker.password;

  if (!isValid) {
    return NextResponse.json({ error: "Usuario ou senha invalidos." }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(COOKIE_NAME, getSessionToken(), {
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
