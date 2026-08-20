import type { Job, Run, RunStatus, Scope } from "@schedio/embed";
import { mapTimetableToSchedule } from "./cadence";
import type { AirflowDag, AirflowDagRun, AirflowScopeStrategy } from "./types";

const DEFAULT_DURATION_MINUTES = 30;

/**
 * Airflow DAG runs only ever hold "queued" | "running" | "success" |
 * "failed" — there's no DAG-run-level "retrying" the way Schedio's model
 * has one. Retries happen per-task inside Airflow, invisible at this
 * (DAG) granularity: a DAG run that succeeds after an internal task retry
 * just reads as a normal success run here. "queued" isn't reported as a
 * run at all — it hasn't started, so there's nothing yet to show.
 */
function mapDagRunState(state: string): RunStatus | undefined {
  switch (state) {
    case "success":
      return "success";
    case "failed":
      return "failed";
    case "running":
      return "running";
    default:
      return undefined;
  }
}

export function mapDagRunToRun(dagRun: AirflowDagRun): Run | undefined {
  const status = mapDagRunState(dagRun.state);
  if (!status) return undefined;

  return {
    id: dagRun.dag_run_id,
    jobId: dagRun.dag_id,
    scheduledAt: dagRun.logical_date,
    startedAt: dagRun.start_date ?? undefined,
    endedAt: dagRun.end_date ?? undefined,
    status,
    attempt: 1,
    errorSummary: status === "failed" ? "Failed — see this DAG run's task logs in Airflow for details" : undefined,
  };
}

/** Average duration of recent successful runs — Airflow has no DAG-level "expected duration" to read directly, so this is observed, not configured. */
export function computeAverageDurationMinutes(runs: Run[]): number {
  const durations = runs
    .filter((r) => r.status === "success" && r.startedAt && r.endedAt)
    .map((r) => (new Date(r.endedAt!).getTime() - new Date(r.startedAt!).getTime()) / 60_000);
  if (durations.length === 0) return DEFAULT_DURATION_MINUTES;
  return Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length);
}

export function mapDagToJob(
  dag: AirflowDag,
  opts: { scopeId: string; averageDurationMinutes: number; graceMinutes: number; uiBaseUrl: string },
): Job {
  const owners = dag.owners?.filter(Boolean) ?? [];
  return {
    id: dag.dag_id,
    name: dag.dag_display_name?.trim() || dag.dag_id,
    owner: owners.length > 0 ? owners.join(", ") : opts.scopeId,
    scopeId: opts.scopeId,
    schedule: mapTimetableToSchedule(dag.timetable_summary),
    sla: { expectedDurationMinutes: opts.averageDurationMinutes, graceMinutes: opts.graceMinutes },
    // Cross-DAG dependencies (TriggerDagRunOperator, sensors, or Airflow
    // 3's asset-based scheduling) aren't derivable from the /dags listing
    // alone — see the README's "Known limitations". Left empty rather
    // than guessed: a missing edge is an honest gap; a wrong one would
    // actively mislead triage, which is worse.
    dependsOn: [],
    // Airflow 3's own DAG page — same URL Airflow's UI itself links to for
    // this DAG's grid view.
    sourceUrl: `${opts.uiBaseUrl}/dags/${encodeURIComponent(dag.dag_id)}/grid`,
    sourceLabel: "Airflow",
  };
}

/**
 * "instance": every DAG in this Airflow becomes one scope — zero config,
 * works immediately regardless of tagging discipline. "tag": each DAG's
 * first tag becomes its own scope; untagged DAGs share one fallback scope
 * so nothing silently disappears from the view.
 */
export function deriveScopes(
  dags: AirflowDag[],
  config: { instanceId: string; instanceName: string; scopeStrategy: AirflowScopeStrategy },
): { scopeIdByDagId: Map<string, string>; scopes: Scope[] } {
  if (config.scopeStrategy === "instance") {
    const scope: Scope = { id: config.instanceId, name: config.instanceName, kind: "team" };
    return { scopeIdByDagId: new Map(dags.map((d) => [d.dag_id, scope.id])), scopes: [scope] };
  }

  const scopesById = new Map<string, Scope>();
  const scopeIdByDagId = new Map<string, string>();
  const fallbackId = `${config.instanceId}-untagged`;

  for (const dag of dags) {
    const firstTag = dag.tags?.[0]?.name;
    const scopeId = firstTag ? `${config.instanceId}-${firstTag}` : fallbackId;
    const scopeName = firstTag ?? `${config.instanceName} (untagged)`;
    if (!scopesById.has(scopeId)) scopesById.set(scopeId, { id: scopeId, name: scopeName, kind: "team" });
    scopeIdByDagId.set(dag.dag_id, scopeId);
  }

  return { scopeIdByDagId, scopes: [...scopesById.values()] };
}
