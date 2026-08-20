"use server";

import { cookies } from "next/headers";
import { isMockUserId, PREVIEW_USER_COOKIE, type MockUserId } from "./mockUsers";

/**
 * The demo's stand-in for "sign in as" — a real deployment would verify
 * credentials/SSO here, not just accept a client-chosen id, but the shape
 * is the same either way: the *server* decides identity and hands the
 * client an httpOnly cookie it can't read or forge, rather than trusting
 * whatever the client claims on each request (e.g. a `?userId=` query
 * param, which anyone could edit to escalate their own access).
 */
export async function setPreviewUser(userId: MockUserId): Promise<void> {
  if (!isMockUserId(userId)) return;
  const store = await cookies();
  store.set(PREVIEW_USER_COOKIE, userId, { httpOnly: true, sameSite: "lax", path: "/" });
}
