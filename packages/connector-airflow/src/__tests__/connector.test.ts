import { test } from "node:test";
import assert from "node:assert/strict";
import { createAirflowConnector } from "../connector";

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? (init.ok === false ? 500 : 200),
    headers: { "content-type": "application/json" },
  });
}

const DAGS = [
  { dag_id: "daily_revenue_etl", dag_display_name: "Daily Revenue ETL", owners: ["data-eng"], tags: [{ name: "finance" }], timetable_summary: "0 6 * * *" },
  { dag_id: "hourly_events_ingest", owners: [], tags: [{ name: "platform" }], timetable_summary: "@hourly" },
];

const DAG_RUNS: Record<string, unknown[]> = {
  daily_revenue_etl: [
    { dag_run_id: "r1", dag_id: "daily_revenue_etl", logical_date: "2026-08-15T06:00:00Z", start_date: "2026-08-15T06:00:00Z", end_date: "2026-08-15T06:20:00Z", state: "success" },
    { dag_run_id: "r2", dag_id: "daily_revenue_etl", logical_date: "2026-08-16T06:00:00Z", start_date: "2026-08-16T06:00:00Z", end_date: null, state: "failed" },
  ],
  hourly_events_ingest: [
    { dag_run_id: "r3", dag_id: "hourly_events_ingest", logical_date: "2026-08-16T18:00:00Z", start_date: "2026-08-16T18:00:00Z", end_date: "2026-08-16T18:05:00Z", state: "success" },
  ],
};

function fakeFetch(options: { healthy?: boolean; failDagRunsFor?: string } = {}): typeof fetch {
  const healthy = options.healthy ?? true;
  return (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes("/api/v2/monitor/health")) {
      return healthy ? jsonResponse({ scheduler: { status: "healthy" } }) : jsonResponse({}, { ok: false, status: 503 });
    }
    if (url.includes("/dagRuns")) {
      const dagId = decodeURIComponent(url.split("/api/v2/dags/")[1].split("/dagRuns")[0]);
      if (dagId === options.failDagRunsFor) throw new Error("simulated network failure");
      return jsonResponse({ dag_runs: DAG_RUNS[dagId] ?? [] });
    }
    if (url.includes("/api/v2/dags")) {
      return jsonResponse({ dags: DAGS });
    }
    throw new Error(`unexpected request: ${url}`);
  }) as typeof fetch;
}

test("happy path: maps dags + runs into a real snapshot", async () => {
  const connector = createAirflowConnector({
    id: "airflow-prod",
    baseUrl: "https://airflow.example.com",
    auth: { type: "token", token: "t" },
    fetchImpl: fakeFetch(),
  });

  const snapshot = await connector(new Date("2026-08-16T19:00:00Z"), {});

  assert.equal(snapshot.jobs.length, 2);
  assert.equal(snapshot.scopes.length, 1);
  assert.equal(snapshot.scopes[0].id, "airflow-prod");
  assert.deepEqual([...snapshot.reachableScopeIds], ["airflow-prod"]);
  assert.equal(snapshot.runsByJobId.get("daily_revenue_etl")?.length, 2);
  assert.equal(snapshot.runsByJobId.get("hourly_events_ingest")?.length, 1);

  const revenueJob = snapshot.jobs.find((j) => j.id === "daily_revenue_etl");
  assert.equal(revenueJob?.owner, "data-eng");
  assert.deepEqual(revenueJob?.schedule, { cadence: "daily", hour: 6, minute: 0 });
});

test("unreachable: a failed health check reports zero reachable scopes, no jobs, and never throws", async () => {
  const connector = createAirflowConnector({
    id: "airflow-staging",
    baseUrl: "https://staging.example.com",
    auth: { type: "basic", username: "u", password: "p" },
    fetchImpl: fakeFetch({ healthy: false }),
  });

  const snapshot = await connector(new Date(), {});
  assert.equal(snapshot.jobs.length, 0);
  assert.equal(snapshot.reachableScopeIds.size, 0);
  assert.equal(snapshot.scopes[0].id, "airflow-staging");
});

test("reachabilityOverrides forces a connector unreachable regardless of its real health", async () => {
  const connector = createAirflowConnector({
    id: "airflow-prod",
    baseUrl: "https://airflow.example.com",
    auth: { type: "token", token: "t" },
    fetchImpl: fakeFetch({ healthy: true }),
  });

  const snapshot = await connector(new Date(), { "airflow-prod": false });
  assert.equal(snapshot.jobs.length, 0);
  assert.equal(snapshot.reachableScopeIds.size, 0);
});

test("a mid-fetch failure (after a healthy check) degrades to unreachable instead of throwing", async () => {
  const connector = createAirflowConnector({
    id: "airflow-prod",
    baseUrl: "https://airflow.example.com",
    auth: { type: "token", token: "t" },
    fetchImpl: fakeFetch({ failDagRunsFor: "hourly_events_ingest" }),
  });

  // Must not reject — a well-behaved connector never throws.
  const snapshot = await connector(new Date(), {});
  assert.equal(snapshot.jobs.length, 0);
  assert.equal(snapshot.reachableScopeIds.size, 0);
});

test("tag scope strategy is threaded through end to end", async () => {
  const connector = createAirflowConnector({
    id: "airflow-prod",
    baseUrl: "https://airflow.example.com",
    auth: { type: "token", token: "t" },
    scopeStrategy: "tag",
    fetchImpl: fakeFetch(),
  });

  const snapshot = await connector(new Date(), {});
  const scopeIds = snapshot.scopes.map((s) => s.id).sort();
  assert.deepEqual(scopeIds, ["airflow-prod-finance", "airflow-prod-platform"]);
});

test("pollIntervalMs is left unset when not configured, so @schedio/embed's default (30s) applies", () => {
  const connector = createAirflowConnector({
    id: "airflow-prod",
    baseUrl: "https://airflow.example.com",
    auth: { type: "token", token: "t" },
    fetchImpl: fakeFetch(),
  });
  assert.equal(connector.pollIntervalMs, undefined);
});

test("pollIntervalMs is threaded through when explicitly configured, including 0 (disabled)", () => {
  const custom = createAirflowConnector({
    id: "airflow-prod",
    baseUrl: "https://airflow.example.com",
    auth: { type: "token", token: "t" },
    pollIntervalMs: 60_000,
    fetchImpl: fakeFetch(),
  });
  assert.equal(custom.pollIntervalMs, 60_000);

  const disabled = createAirflowConnector({
    id: "airflow-prod",
    baseUrl: "https://airflow.example.com",
    auth: { type: "token", token: "t" },
    pollIntervalMs: 0,
    fetchImpl: fakeFetch(),
  });
  assert.equal(disabled.pollIntervalMs, 0);
});
