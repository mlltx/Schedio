import { combineConnectors, mockConnector, type ConnectorFn } from "@schedio/embed";

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

/**
 * Two "Airflow instances" combined into one view — both backed by the same
 * built-in mock data, standing in for what a real deployment would do with
 * `combineConnectors({ "airflow-prod": createAirflowConnector(...), ... })`
 * from `@schedio/connector-airflow`. See CLAUDE.md's "Multiple connectors"
 * section and the connector architecture design doc for the real thing.
 */
export const combinedDemoConnector: ConnectorFn = combineConnectors({
  "us-east": withRegionLabel(mockConnector, "US-East"),
  "eu-west": withRegionLabel(mockConnector, "EU-West"),
});
