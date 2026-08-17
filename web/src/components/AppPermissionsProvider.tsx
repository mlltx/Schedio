"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { PermissionsProvider, type Permissions } from "@schedio/embed";
import { DEFAULT_MOCK_USER_ID, permissionsFor, type MockUserId } from "@/lib/mockUsers";
import { setPreviewUser } from "@/lib/previewUserActions";

/**
 * Same shape as AppConnectorProvider/AppTenantProvider: which mock user is
 * selected is our own demo-preview state, not something @schedio/embed
 * knows about. Unlike those two, the *data* fetch itself doesn't read this
 * context at all — app/api/snapshot/route.ts resolves Permissions from an
 * httpOnly cookie server-side (see setPreviewUser), so a viewer's own
 * client state can't be the thing granting them access. `permissions` here
 * only feeds @schedio/embed's PermissionsProvider (client-side capability
 * checks, which are UI-only by design) and gives useScopedConnector a
 * value that changes identity when the user switches, to trigger an
 * immediate refetch instead of waiting out the poll interval.
 */
interface AppPermissionsContextValue {
  userId: MockUserId;
  setUserId: (id: MockUserId) => Promise<void>;
  permissions: Permissions;
}

const defaultPermissions = permissionsFor(DEFAULT_MOCK_USER_ID);
const AppPermissionsContext = createContext<AppPermissionsContextValue>({
  userId: DEFAULT_MOCK_USER_ID,
  setUserId: async () => {},
  permissions: defaultPermissions,
});

export function AppPermissionsProvider({ children }: { children: ReactNode }) {
  const [userId, setUserIdState] = useState<MockUserId>(DEFAULT_MOCK_USER_ID);
  const permissions = useMemo<Permissions>(() => permissionsFor(userId), [userId]);

  // Await the cookie write before flipping local state, so the connector
  // this triggers a refetch on the next render never races the server
  // action that's supposed to already have updated by then.
  const setUserId = useCallback(async (id: MockUserId) => {
    await setPreviewUser(id);
    setUserIdState(id);
  }, []);

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
