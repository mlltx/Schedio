"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { PermissionsProvider, type Capability, type Permissions } from "@schedio/embed";

/**
 * Same shape as AppConnectorProvider/AppTenantProvider: which mock user is
 * selected is our own demo-preview state, not something @schedio/embed
 * knows about — it only ever sees a resolved `Permissions` value (or its
 * absence, meaning full access). A real host derives this from its own
 * signed-in user, not a runtime switcher.
 */
export type MockUserId = "admin" | "data-platform-viewer" | "payments-viewer";

interface MockUser {
  label: string;
  /**
   * Base (unprefixed) team scope ids, or "all". `useScopedConnector`
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

interface AppPermissionsContextValue {
  userId: MockUserId;
  setUserId: (id: MockUserId) => void;
  /** Base (unprefixed) permissions for the selected mock user — see MockUser.scopeIds. */
  permissions: Permissions;
}

const defaultUser = MOCK_USERS.admin;
const AppPermissionsContext = createContext<AppPermissionsContextValue>({
  userId: "admin",
  setUserId: () => {},
  permissions: { scopeIds: defaultUser.scopeIds, capabilities: defaultUser.capabilities },
});

export function AppPermissionsProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<MockUserId>("admin");
  const permissions = useMemo<Permissions>(() => {
    const user = MOCK_USERS[userId];
    return { scopeIds: user.scopeIds, capabilities: user.capabilities };
  }, [userId]);

  return (
    <AppPermissionsContext.Provider value={{ userId, setUserId, permissions }}>
      {/* Feeds @schedio/embed's own half of the seam too — nothing in the
          package reads a Capability yet, but this is where a host would
          wire it once a write action exists. */}
      <PermissionsProvider permissions={permissions}>{children}</PermissionsProvider>
    </AppPermissionsContext.Provider>
  );
}

export function useAppPermissions(): AppPermissionsContextValue {
  return useContext(AppPermissionsContext);
}
