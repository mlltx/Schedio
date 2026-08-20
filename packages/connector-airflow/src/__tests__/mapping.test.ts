import { test } from "node:test";
import assert from "node:assert/strict";
import { computeAverageDurationMinutes, deriveScopes, mapDagRunToRun, mapDagToJob } from "../mapping";
import type { AirflowDag, AirflowDagRun } from "../types";

test("mapDagRunToRun maps success/failed/running directly", () => {
  const base: AirflowDagRun = {
    dag_run_id: "scheduled__2026-08-16T06:00:00+00:00",
    dag_id: "daily_revenue_etl",
    logical_date: "2026-08-16T06:00:00Z",
    start_date: "2026-08-16T06:00:05Z",
    end_date: "2026-08-16T06:22:10Z",
    state: "success",
  };

  assert.equal(mapDagRunToRun(base)?.status, "success");
  assert.equal(mapDagRunToRun({ ...base, state: "failed" })?.status, "failed");
  assert.equal(mapDagRunToRun({ ...base, state: "running", end_date: null })?.status, "running");
});

test("mapDagRunToRun omits queued runs (nothing to show yet) and unrecognized states", () => {
  const base: AirflowDagRun = {
    dag_run_id: "manual__2026-08-16T07:00:00+00:00",
    dag_id: "daily_revenue_etl",
    logical_date: "2026-08-16T07:00:00Z",
    state: "queued",
  };
  assert.equal(mapDagRunToRun(base), undefined);
  assert.equal(mapDagRunToRun({ ...base, state: "some_future_airflow_state" }), undefined);
});

test("mapDagRunToRun carries a pointer errorSummary only for failed runs", () => {
  const base: AirflowDagRun = {
    dag_run_id: "r1",
    dag_id: "d1",
    logical_date: "2026-08-16T06:00:00Z",
    start_date: "2026-08-16T06:00:00Z",
    end_date: "2026-08-16T06:05:00Z",
    state: "failed",
  };
  assert.ok(mapDagRunToRun(base)?.errorSummary);
  assert.equal(mapDagRunToRun({ ...base, state: "success" })?.errorSummary, undefined);
});

test("computeAverageDurationMinutes averages successful run durations, ignoring failures", () => {
  const runs = [
    mapDagRunToRun({
      dag_run_id: "r1",
      dag_id: "d1",
      logical_date: "2026-08-14T06:00:00Z",
      start_date: "2026-08-14T06:00:00Z",
      end_date: "2026-08-14T06:20:00Z", // 20 min
      state: "success",
    })!,
    mapDagRunToRun({
      dag_run_id: "r2",
      dag_id: "d1",
      logical_date: "2026-08-15T06:00:00Z",
      start_date: "2026-08-15T06:00:00Z",
      end_date: "2026-08-15T06:40:00Z", // 40 min
      state: "success",
    })!,
    mapDagRunToRun({
      dag_run_id: "r3",
      dag_id: "d1",
      logical_date: "2026-08-16T06:00:00Z",
      start_date: "2026-08-16T06:00:00Z",
      end_date: "2026-08-16T06:05:00Z",
      state: "failed", // excluded from the average
    })!,
  ];
  assert.equal(computeAverageDurationMinutes(runs), 30);
});

test("computeAverageDurationMinutes falls back to a default when there's no history yet", () => {
  assert.equal(computeAverageDurationMinutes([]), 30);
});

test("mapDagToJob joins multiple owners and falls back to the scope when a DAG declares none", () => {
  const dag: AirflowDag = {
    dag_id: "daily_revenue_etl",
    dag_display_name: "Daily Revenue ETL",
    owners: ["alice", "data-eng"],
    timetable_summary: "0 6 * * *",
  };
  const job = mapDagToJob(dag, {
    scopeId: "airflow-prod",
    averageDurationMinutes: 25,
    graceMinutes: 20,
    uiBaseUrl: "https://airflow.example.com",
  });
  assert.equal(job.id, "daily_revenue_etl");
  assert.equal(job.name, "Daily Revenue ETL");
  assert.equal(job.owner, "alice, data-eng");
  assert.deepEqual(job.schedule, { cadence: "daily", hour: 6, minute: 0 });
  assert.deepEqual(job.sla, { expectedDurationMinutes: 25, graceMinutes: 20 });
  assert.deepEqual(job.dependsOn, []);
  assert.equal(job.sourceUrl, "https://airflow.example.com/dags/daily_revenue_etl/grid");
  assert.equal(job.sourceLabel, "Airflow");

  const unowned = mapDagToJob(
    { ...dag, owners: [] },
    { scopeId: "airflow-prod", averageDurationMinutes: 25, graceMinutes: 20, uiBaseUrl: "https://airflow.example.com" },
  );
  assert.equal(unowned.owner, "airflow-prod");
});

test("mapDagToJob falls back to dag_id when there's no display name", () => {
  const job = mapDagToJob(
    { dag_id: "legacy_report_job" },
    { scopeId: "s", averageDurationMinutes: 30, graceMinutes: 20, uiBaseUrl: "https://airflow.example.com" },
  );
  assert.equal(job.name, "legacy_report_job");
});

test("deriveScopes 'instance' strategy puts every DAG in one scope", () => {
  const dags: AirflowDag[] = [{ dag_id: "a" }, { dag_id: "b" }];
  const { scopes, scopeIdByDagId } = deriveScopes(dags, {
    instanceId: "airflow-prod",
    instanceName: "Airflow (prod)",
    scopeStrategy: "instance",
  });
  assert.deepEqual(scopes, [{ id: "airflow-prod", name: "Airflow (prod)", kind: "team" }]);
  assert.equal(scopeIdByDagId.get("a"), "airflow-prod");
  assert.equal(scopeIdByDagId.get("b"), "airflow-prod");
});

test("deriveScopes 'tag' strategy groups by first tag, with a shared fallback for untagged DAGs", () => {
  const dags: AirflowDag[] = [
    { dag_id: "a", tags: [{ name: "finance" }, { name: "critical" }] },
    { dag_id: "b", tags: [{ name: "finance" }] },
    { dag_id: "c", tags: [] },
    { dag_id: "d" },
  ];
  const { scopes, scopeIdByDagId } = deriveScopes(dags, {
    instanceId: "airflow-prod",
    instanceName: "Airflow (prod)",
    scopeStrategy: "tag",
  });

  assert.equal(scopeIdByDagId.get("a"), "airflow-prod-finance");
  assert.equal(scopeIdByDagId.get("b"), "airflow-prod-finance");
  assert.equal(scopeIdByDagId.get("c"), "airflow-prod-untagged");
  assert.equal(scopeIdByDagId.get("d"), "airflow-prod-untagged");
  // Exactly two scopes, not one per DAG.
  assert.equal(scopes.length, 2);
  assert.ok(scopes.some((s) => s.id === "airflow-prod-finance" && s.name === "finance"));
  assert.ok(scopes.some((s) => s.id === "airflow-prod-untagged"));
});
