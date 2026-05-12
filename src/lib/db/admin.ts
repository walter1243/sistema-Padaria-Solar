import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { adminAccounts } from "@/lib/db/schema";

type AdminCredentials = {
  username: string;
  password: string;
  sessionToken: string;
};

function envCredentials(): AdminCredentials {
  return {
    username: process.env.ADMIN_USERNAME || "admin",
    password: process.env.ADMIN_PASSWORD || "123456",
    sessionToken: process.env.ADMIN_SESSION_TOKEN || "padaria_admin_token_dev",
  };
}

export async function getAdminCredentials() {
  const existing = await db.query.adminAccounts.findFirst();
  if (existing) {
    return {
      id: existing.id,
      username: existing.username,
      password: existing.password,
      sessionToken: envCredentials().sessionToken,
    };
  }

  const env = envCredentials();
  const [created] = await db
    .insert(adminAccounts)
    .values({
      username: env.username,
      password: env.password,
    })
    .returning();

  return {
    id: created.id,
    username: created.username,
    password: created.password,
    sessionToken: env.sessionToken,
  };
}

export async function updateAdminCredentials(next: { username: string; password: string }) {
  const current = await getAdminCredentials();
  const [updated] = await db
    .update(adminAccounts)
    .set({
      username: next.username,
      password: next.password,
      updatedAt: new Date(),
    })
    .where(eq(adminAccounts.id, current.id))
    .returning();

  return updated;
}