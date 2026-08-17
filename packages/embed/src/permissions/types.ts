/**
 * The RBAC seam's second half — see `withScopeAccess` in `model/connector.ts`
 * for the first (which scopes a viewer can see, enforced at the data layer).
 * This half is about actions, not data: which write operations a viewer may
 * perform. Nothing in `packages/embed` performs a write yet — per
 * MISSION.md's "read-first, write-second" — so `Capability` is deliberately
 * ahead of any UI that reads it. It exists now so the day an action like
 * "acknowledge this failure" ships, gating it is a one-line `hasCapability`
 * check against an already-established shape, not a new mechanism.
 *
 * Real enforcement for any of these, once they exist, always happens
 * server-side (proxied back through the model boundary to the native
 * engine, per MISSION.md) — `hasCapability` only decides what the UI
 * offers to attempt, the same way a disabled button isn't a security
 * control.
 */
export type Capability = "manage_connectors" | "manage_tenant_config" | "acknowledge_run" | "retrigger_run";

export interface Permissions {
  /**
   * Which scopes this viewer may see. This value is what you pass to
   * `withScopeAccess` — `Permissions` itself doesn't filter anything; it's
   * the single resolved record a host derives once (from its own IdP/
   * session) and threads through to both the connector wrapper and this
   * context, so scope access and capabilities never drift out of sync as
   * two independently-tracked variables.
   */
  scopeIds: "all" | string[];
  capabilities: "all" | Set<Capability>;
}

/**
 * The default when no `PermissionsProvider` wraps the tree — every scope,
 * every capability. RBAC is opt-in: a host that doesn't care about it gets
 * exactly today's unrestricted behavior with zero code changes, the same
 * way not passing a `connector` gets the mock one.
 */
export const FULL_ACCESS_PERMISSIONS: Permissions = { scopeIds: "all", capabilities: "all" };

export function hasCapability(permissions: Permissions, capability: Capability): boolean {
  return permissions.capabilities === "all" || permissions.capabilities.has(capability);
}
