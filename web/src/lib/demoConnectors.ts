import { combineConnectors, mockConnector, type ConnectorFn } from "@schedio/embed/server";

/**
 * `ConnectorFn` is just a function, so it composes the same way an Express
 * middleware or an Apollo Link does — wrap one to get another. This is
 * demo-only (our own seed data standing in for "two real Airflow
 * instances"), which is exactly why it lives in web/, not in the package:
 * a real host's connector already has its own real, distinct names.
 */
function withRegionLabel(connector: ConnectorFn, label: string): ConnectorFn {
  return async (now, reachabilityOverrides) => {
    const snapshot = await connector(now, reachabilityOverrides);
    return {
      ...snapshot,
      scopes: snapshot.scopes.map((s) => (s.kind === "team" ? { ...s, name: `${s.name} — ${label}` } : s)),
    };
  };
}

/** The two source keys `combinedDemoConnector` namespaces scope/job ids under — see `expandScopeIdsForRegions`, which needs these to expand a restricted user's base scope ids per-region. */
export const DEMO_REGIONS = ["us-east", "eu-west"] as const;

/**
 * A restricted user's `Permissions.scopeIds` are base, unprefixed team ids
 * (they don't know or care whether the combined connector is even in play).
 * When it is, `combineConnectors` has namespaced every scope id per source,
 * so those base ids need the same treatment before `withScopeAccess` can
 * match anything — and a restricted viewer should see their team on every
 * region it exists in, not just whichever one happened to combine first.
 */
export function expandScopeIdsForRegions(scopeIds: "all" | string[]): "all" | string[] {
  if (scopeIds === "all") return "all";
  return DEMO_REGIONS.flatMap((region) => scopeIds.map((id) => `${region}:${id}`));
}

/**
 * Two "Airflow instances" combined into one view — both backed by the same
 * built-in mock data, standing in for what a real deployment would do with
 * `combineConnectors({ "airflow-prod": createAirflowConnector(...), ... })`
 * from `@schedio/connector-airflow`. See CLAUDE.md's "Multiple connectors"
 * section and the connector architecture design doc for the real thing.
 */
export const combinedDemoConnector: ConnectorFn = combineConnectors({
  [DEMO_REGIONS[0]]: withRegionLabel(mockConnector, "US-East"),
  [DEMO_REGIONS[1]]: withRegionLabel(mockConnector, "EU-West"),
});
