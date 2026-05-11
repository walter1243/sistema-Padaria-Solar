import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const COOKIE_NAME = "padaria_admin_session";

export async function GET() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(COOKIE_NAME)?.value;
  const expected = process.env.ADMIN_SESSION_TOKEN || "padaria_admin_token_dev";

  if (!sessionCookie || sessionCookie !== expected) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({ authenticated: true });
}
