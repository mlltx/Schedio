/**
 * Airflow's own REST API shapes (a small subset — only the fields this
 * connector reads) and this connector's config. Kept separate from
 * mapping.ts so the "what does Airflow's API look like" and "how do we
 * turn that into Schedio's model" concerns don't blur together.
 */

export interface AirflowDag {
  dag_id: string;
  dag_display_name?: string | null;
  owners?: string[] | null;
  tags?: { name: string }[] | null;
  timetable_summary?: string | null;
  is_paused?: boolean;
}

export interface AirflowDagRun {
  dag_run_id: string;
  dag_id: string;
  logical_date: string;
  start_date?: string | null;
  end_date?: string | null;
  /** Airflow's real states: "queued" | "running" | "success" | "failed". Typed loosely in case a future Airflow version adds one. */
  state: string;
}

export interface AirflowBasicAuth {
  type: "basic";
  username: string;
  password: string;
}

export interface AirflowTokenAuth {
  type: "token";
  token: string;
}

export type AirflowAuth = AirflowBasicAuth | AirflowTokenAuth;

export type AirflowScopeStrategy = "instance" | "tag";

export interface AirflowConnectorConfig {
  /**
   * Identifies this instance. Used to name/id its scope under the default
   * "instance" scope strategy, and as the key a real deployment would
   * register this connector under when combining several via
   * `combineConnectors` from @schedio/embed — though combineConnectors
   * namespaces job/scope ids itself regardless of what key you give it,
   * so this doesn't have to match that key exactly.
   */
  id: string;
  /** Display name for this instance's scope when `scopeStrategy` is "instance" (the default). Defaults to `id`. */
  name?: string;
  /** e.g. "https://airflow.internal.example.com" — no trailing slash. */
  baseUrl: string;
  /**
   * Base URL of the Airflow *webserver UI*, if it's hosted separately from
   * the REST API in `baseUrl` (some managed offerings, e.g. Cloud
   * Composer, front the API and the UI at different hosts). Defaults to
   * `baseUrl`, which is correct for a standard Airflow deployment where
   * both are served from the same webserver. Used only to build each
   * job's `sourceUrl` — the "Open in Airflow" link on its detail page.
   */
  uiBaseUrl?: string;
  auth: AirflowAuth;
  /**
   * "instance" (default): every DAG in this instance is one scope, named
   * `name`/`id` — zero config needed, works immediately. "tag": each DAG's
   * first tag becomes its own scope (untagged DAGs share one fallback
   * scope) — more granular, but only as good as this instance's tagging
   * discipline. See the README for the tradeoffs.
   */
  scopeStrategy?: AirflowScopeStrategy;
  /** How long past a run's expected duration before Schedio calls it late/missing. Defaults to 20. */
  graceMinutes?: number;
  /** How many recent runs to average for a DAG's expected duration (Airflow has no DAG-level SLA config to read directly). Defaults to 10. */
  durationSampleSize?: number;
  /**
   * How often (ms) a Schedio view showing this connector re-polls it.
   * Defaults to `DEFAULT_POLL_INTERVAL_MS` (30s) from `@schedio/embed`;
   * set to `0` to disable polling for this instance. Every poll re-fetches
   * every DAG's run history in parallel (see the README's "Known
   * limitations" on unbounded concurrency) — a large instance, or several
   * combined via `combineConnectors`, may want a longer interval to keep
   * load on Airflow's webserver reasonable.
   */
  pollIntervalMs?: number;
  /** Override the global `fetch` — mainly for tests. */
  fetchImpl?: typeof fetch;
}
