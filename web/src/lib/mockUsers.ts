import type { Capability, Permissions } from "@schedio/embed/server";

/**
 * The demo's stand-in for a real user directory — shared by client code
 * (AppPermissionsProvider, for the "Viewing as" switcher's options and
 * optimistic UI) and server code (app/api/snapshot/route.ts, which is the
 * only place that actually decides a request's Permissions). Framework- and
 * client/server-agnostic on purpose: no "use client", no next/headers here.
 */
export type MockUserId = "admin" | "data-platform-viewer" | "payments-viewer";

interface MockUser {
  label: string;
  /**
   * Base (unprefixed) team scope ids, or "all". app/api/snapshot/route.ts
   * expands these per-region when the combined connector is selected
   * ("data-platform" -> "us-east:data-platform" + "eu-west:data-platform")
   * — a restricted user should see their team everywhere it exists, not
   * just in whichever "instance" happens to come first.
   */
  scopeIds: "all" | string[];
  capabilities: "all" | Set<Capability>;
}

export const MOCK_USERS: Record<MockUserId, MockUser> = {
  admin: { label: "Admin — sees everything", scopeIds: "all", capabilities: "all" },
  "data-platform-viewer": { label: "Data Platform viewer", scopeIds: ["data-platform"], capabilities: new Set() },
  "payments-viewer": { label: "Payments viewer", scopeIds: ["payments"], capabilities: new Set() },
};

export const DEFAULT_MOCK_USER_ID: MockUserId = "admin";

/** Set by the `setPreviewUser` Server Function, read by app/api/snapshot/route.ts. Lives here (not in previewUserActions.ts) because a "use server" file may only export async functions. */
export const PREVIEW_USER_COOKIE = "schedio_preview_user";

export function isMockUserId(value: string | undefined): value is MockUserId {
  return !!value && value in MOCK_USERS;
}

/** Base (unprefixed) permissions for a mock user id, falling back to the default user for anything unrecognized (e.g. a stale/tampered cookie value). */
export function permissionsFor(userId: string | undefined): Permissions {
  const user = MOCK_USERS[isMockUserId(userId) ? userId : DEFAULT_MOCK_USER_ID];
  return { scopeIds: user.scopeIds, capabilities: user.capabilities };
}
