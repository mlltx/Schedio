"use client";

import { useMemo } from "react";
import { createProxyConnector, type ConnectorFn, type SerializedConnectorSnapshot } from "@schedio/embed";
import { useAppConnector } from "./AppConnectorProvider";
import { useAppPermissions } from "./AppPermissionsProvider";

/**
 * Talks to app/api/snapshot/route.ts instead of fetching mock data directly
 * in the browser. That route is the one that actually applies
 * withScopeAccess, resolving Permissions from an httpOnly cookie
 * server-side — this hook never sends the current mock user id anywhere;
 * the browser only ever receives whatever the route already decided to
 * filter down to. Every GlanceView/JobDetail/PipelineGraphView instance in
 * web/ goes through this one hook, so the server-side filter can't be
 * bypassed by any individual view fetching a connector directly.
 */
export function useScopedConnector(): ConnectorFn {
  const { mode } = useAppConnector();
  // Not read for the fetch itself (the server resolves the viewer from its
  // own cookie) — only so switching "Viewing as" changes this connector's
  // identity, which is what makes usePromise refetch immediately instead
  // of waiting out the poll interval.
  const { userId } = useAppPermissions();

  return useMemo(
    () =>
      createProxyConnector({
        fetchSnapshot: async (_now, reachabilityOverrides): Promise<SerializedConnectorSnapshot> => {
          const params = new URLSearchParams({ mode, overrides: JSON.stringify(reachabilityOverrides) });
          const res = await fetch(`/api/snapshot?${params}`);
          if (!res.ok) {
            // A well-behaved connector never throws — a failed request
            // reads as "nothing visible right now", not a crash.
            return { jobs: [], scopes: [], runsByJobId: [], reachableScopeIds: [], lastSyncedAt: new Date().toISOString() };
          }
          return (await res.json()) as SerializedConnectorSnapshot;
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- userId is deliberately unused inside the callback (see comment above); it's here only to force a fresh connector, and thus an immediate refetch, when the mock user changes.
    [mode, userId],
  );
}
