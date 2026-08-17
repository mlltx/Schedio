"use client";

import { useMemo } from "react";
import { mockConnector, withScopeAccess, type ConnectorFn } from "@schedio/embed";
import { useAppConnector } from "./AppConnectorProvider";
import { useAppPermissions } from "./AppPermissionsProvider";
import { DEMO_REGIONS } from "@/lib/demoConnectors";

/**
 * The two seams composed the way a real host would compose them: whichever
 * connector AppConnectorProvider's demo switcher selected (single mock, or
 * the combined two-region mock), filtered down to the current mock user's
 * scope access via `withScopeAccess`. Every GlanceView/JobDetail/
 * PipelineGraphView instance in web/ goes through this one hook instead of
 * reading useAppConnector directly, so the RBAC filter can't be forgotten
 * on any of them.
 */
export function useScopedConnector(): ConnectorFn {
  const { mode, connector: baseConnector } = useAppConnector();
  const { permissions } = useAppPermissions();
  const { scopeIds } = permissions;

  return useMemo(() => {
    const connector = baseConnector ?? mockConnector;
    if (scopeIds === "all") return withScopeAccess(connector, "all");

    // The combined connector namespaces every scope id per region
    // (`combineConnectors`) — a viewer restricted to "data-platform" should
    // still see it under both regions, not just whichever came first.
    const namespacedScopeIds = mode === "combined" ? DEMO_REGIONS.flatMap((region) => scopeIds.map((id) => `${region}:${id}`)) : scopeIds;

    return withScopeAccess(connector, namespacedScopeIds);
  }, [baseConnector, mode, scopeIds]);
}
