import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ error: "Modulo de relatorios financeiros removido." }, { status: 410 });
}
