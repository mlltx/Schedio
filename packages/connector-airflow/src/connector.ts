import type { ConnectorFn, ConnectorSnapshot, Job, Run, Scope } from "@schedio/embed";
import { AirflowClient } from "./client";
import { computeAverageDurationMinutes, deriveScopes, mapDagToJob, mapDagRunToRun } from "./mapping";
import type { AirflowConnectorConfig } from "./types";

function unreachableSnapshot(now: Date, scope: Scope): ConnectorSnapshot {
  return {
    jobs: [],
    scopes: [scope],
    runsByJobId: new Map(),
    reachableScopeIds: new Set(),
    lastSyncedAt: now.toISOString(),
  };
}

/**
 * Maps one Airflow 3 instance into Schedio's model. DAG = Job (see the
 * README for why: task-level detail is a plausible future connector, not
 * required to match what Schedio shows today). To view several Airflow
 * instances — or Airflow alongside another backend — at once, combine
 * this with `combineConnectors` from `@schedio/embed`; nothing here needs
 * to know it's being combined.
 */
export function createAirflowConnector(config: AirflowConnectorConfig): ConnectorFn {
  const client = new AirflowClient({
    baseUrl: config.baseUrl,
    auth: config.auth,
    fetchImpl: config.fetchImpl ?? fetch,
  });
  const scopeStrategy = config.scopeStrategy ?? "instance";
  const graceMinutes = config.graceMinutes ?? 20;
  const durationSampleSize = config.durationSampleSize ?? 10;
  const instanceName = config.name ?? config.id;
  const instanceScope: Scope = { id: config.id, name: instanceName, kind: "team" };

  return async (now, reachabilityOverrides): Promise<ConnectorSnapshot> => {
    // The override key is this connector's own `id` — not a per-scope id
    // the way the built-in mock connector's demo outage simulator uses
    // one — since under "tag" scoping there may be several scopes and no
    // single one of them represents "this whole instance".
    const forcedReachable = reachabilityOverrides[config.id];
    if (forcedReachable === false) return unreachableSnapshot(now, instanceScope);

    const healthy = forcedReachable ?? (await client.checkHealth());
    if (!healthy) return unreachableSnapshot(now, instanceScope);

    try {
      const dags = await client.listDags();
      const { scopeIdByDagId, scopes } = deriveScopes(dags, { instanceId: config.id, instanceName, scopeStrategy });

      const dagsWithRuns = await Promise.all(
        dags.map(async (dag) => {
          const dagRuns = await client.listDagRuns(dag.dag_id, durationSampleSize);
          const runs = dagRuns.map(mapDagRunToRun).filter((r): r is Run => r !== undefined);
          return { dag, runs };
        }),
      );

      const jobs: Job[] = [];
      const runsByJobId = new Map<string, Run[]>();
      for (const { dag, runs } of dagsWithRuns) {
        runsByJobId.set(dag.dag_id, runs);
        jobs.push(
          mapDagToJob(dag, {
            scopeId: scopeIdByDagId.get(dag.dag_id)!,
            averageDurationMinutes: computeAverageDurationMinutes(runs),
            graceMinutes,
          }),
        );
      }

      return { jobs, scopes, runsByJobId, reachableScopeIds: new Set(scopes.map((s) => s.id)), lastSyncedAt: now.toISOString() };
    } catch {
      // The health check passed but something failed between there and
      // here (a transient error, a permissions issue on one endpoint,
      // Airflow degrading mid-fetch) — report unreachable rather than
      // throwing. A connector that can throw makes every caller (Schedio's
      // own components, combineConnectors, any host) responsible for
      // catching it; one that never does only has to be *read*.
      return unreachableSnapshot(now, instanceScope);
    }
  };
}
