"use client";

import { createContext, useContext, type ReactNode } from "react";
import { FULL_ACCESS_PERMISSIONS, type Permissions } from "./types";

/**
 * Wraps whatever renders `GlanceView`/`JobDetail`, the same way
 * `TenantConfigProvider` does — one `permissions` value, no internal
 * "switch user" state, because a real deployment re-renders with a
 * different value when the signed-in viewer changes rather than Schedio
 * tracking who's logged in itself. Schedio never owns identity; see
 * `withScopeAccess` in `model/connector.ts` for the other half of this
 * seam, which is where scope access is actually enforced. This context is
 * only for `Capability` checks a component might make before rendering a
 * write affordance — none exist in `packages/embed` yet.
 */
const PermissionsContext = createContext<Permissions>(FULL_ACCESS_PERMISSIONS);

export function PermissionsProvider({
  permissions = FULL_ACCESS_PERMISSIONS,
  children,
}: {
  permissions?: Permissions;
  children: ReactNode;
}) {
  return <PermissionsContext.Provider value={permissions}>{children}</PermissionsContext.Provider>;
}

export function usePermissions(): Permissions {
  return useContext(PermissionsContext);
}
