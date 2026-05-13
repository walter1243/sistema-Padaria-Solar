import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tableSessions } from "@/lib/db/schema";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tableId = String(searchParams.get("tableId") ?? "").trim();
  const sessionId = String(searchParams.get("sessionId") ?? "").trim();

  if (!tableId || !sessionId) {
    return NextResponse.json({ status: "invalid" }, { status: 400 });
  }

  const currentSession = await db.query.tableSessions.findFirst({
    where: and(eq(tableSessions.tableId, tableId), eq(tableSessions.sessionId, sessionId)),
  });

  if (!currentSession) {
    return NextResponse.json({ status: "not-found" });
  }

  if (currentSession.status === "closed") {
    return NextResponse.json({ status: "closed" });
  }

  const activeSession = await db.query.tableSessions.findFirst({
    where: and(eq(tableSessions.tableId, tableId), eq(tableSessions.status, "active")),
  });

  if (!activeSession) {
    return NextResponse.json({ status: "closed" });
  }

  if (activeSession.sessionId !== sessionId) {
    return NextResponse.json({ status: "replaced" });
  }

  return NextResponse.json({ status: "active" });
}
