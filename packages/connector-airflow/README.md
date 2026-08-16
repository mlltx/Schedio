# @schedio/connector-airflow

Maps an [Apache Airflow](https://airflow.apache.org/) 3 instance into
[Schedio](../../README.md)'s model, via Airflow's REST API. See the repo
root's connector architecture design for how this fits into the bigger
picture: many connectors, installed and bundled independently, composed at
the host's discretion.

Depends on nothing but `fetch`. `@schedio/embed` is a type-only dependency
— it never ships in this package's bundle (verify yourself: `grep
schedio/embed dist/index.js` after a build turns up nothing).

## Install

```bash
npm install @schedio/connector-airflow @schedio/embed
```

## Quick start

```ts
import { createAirflowConnector } from "@schedio/connector-airflow";
import { GlanceView } from "@schedio/embed";

const connector = createAirflowConnector({
  id: "airflow-prod",
  baseUrl: "https://airflow.internal.example.com",
  auth: { type: "token", token: process.env.AIRFLOW_API_TOKEN! },
});

<GlanceView connector={connector} showDemoControls={false} />;
```

## Multiple Airflow instances (or Airflow + something else)

```ts
import { combineConnectors } from "@schedio/embed";
import { createAirflowConnector } from "@schedio/connector-airflow";

const connector = combineConnectors({
  "airflow-prod": createAirflowConnector({ id: "airflow-prod", baseUrl: "...", auth: { type: "token", token: "..." } }),
  "airflow-staging": createAirflowConnector({ id: "airflow-staging", baseUrl: "...", auth: { type: "token", token: "..." } }),
});

<GlanceView connector={connector} />;
```

`combineConnectors` namespaces every job/scope id itself — this connector
doesn't need to know it's being combined, or with what.

## Config

| Field | Type | Default | |
|---|---|---|---|
| `id` | `string` | required | Identifies this instance — names its scope under the default scope strategy. |
| `baseUrl` | `string` | required | No trailing slash, e.g. `https://airflow.example.com`. |
| `auth` | `{ type: "token"; token }` \| `{ type: "basic"; username; password }` | required | |
| `name` | `string` | `id` | Display name for this instance's scope. |
| `scopeStrategy` | `"instance"` \| `"tag"` | `"instance"` | See below. |
| `graceMinutes` | `number` | `20` | How long past expected before a run reads as late/missing. |
| `durationSampleSize` | `number` | `10` | Recent runs averaged for a DAG's expected duration. |
| `pollIntervalMs` | `number` | `30_000` (from `@schedio/embed`) | How often a Schedio view re-polls this connector. `0` disables polling. See "Polling" below. |
| `fetchImpl` | `typeof fetch` | global `fetch` | Override for tests. |

**Scope strategy** — `"instance"` puts every DAG in this Airflow into one
scope, named `name`/`id`; zero config, works immediately regardless of
tagging discipline. `"tag"` uses each DAG's first tag as its scope
(untagged DAGs share one fallback scope so nothing silently disappears);
more useful once this instance's DAG tags reliably reflect team/domain
ownership, but only as good as that tagging discipline actually is.

## Polling

Schedio doesn't get pushed updates from Airflow — a Schedio view showing
this connector re-fetches automatically every 30 seconds by default (see
`@schedio/embed`'s README for how this works generally: it's a plain
timer re-running the connector, paused while the browser tab isn't
visible). That means **every poll fetches every DAG's run history again,
in parallel, per open browser tab** — the same request pattern described
in "Mapping" below, just repeating. 30s is fine for a handful of viewers
against a normally-provisioned Airflow webserver; raise
`pollIntervalMs` (or set it to `0` to disable polling and rely on manual
refresh) if you have many concurrent viewers, a large number of DAGs, or
a webserver you'd rather not hammer on a timer.

## Mapping

A DAG is a Job — matching the granularity everything else in Schedio's
model already works at. Task-level detail is a plausible future connector,
not required for parity with what Schedio shows today.

| Airflow | Schedio | |
|---|---|---|
| `GET /api/v2/dags` | `Job[]` | `dag_id` → id, `dag_display_name` (falls back to `dag_id`) → name, `owners` (joined) → owner |
| `timetable_summary` | `Schedule` | common cron patterns + `@hourly`/`@daily`/`@weekly`/`@monthly` map exactly; anything unrecognized approximates to daily — see "Known limitations" |
| `GET /api/v2/dags/{id}/dagRuns` | `Run[]` | `logical_date` → scheduledAt, `start_date`/`end_date` → startedAt/endedAt |
| DAG run state `success` / `failed` / `running` | `RunStatus` | direct |
| DAG run state `queued` | — | not reported — nothing to show until it starts |
| — (no DAG-level SLA in Airflow) | `sla.expectedDurationMinutes` | average of the last `durationSampleSize` successful runs' actual durations |
| `GET /api/v2/monitor/health` | `reachableScopeIds` | a failed check (or anything that throws after it passes) reports this instance fully unreachable |

## Known limitations

- **No cross-DAG dependencies (`dependsOn` is always empty).** Airflow
  doesn't expose DAG-to-DAG dependencies at the `/dags` listing level —
  they live in `TriggerDagRunOperator` calls, sensors, or Airflow 3's
  asset-based scheduling, none of which this version reads. A missing
  dependency edge is an honest gap; a guessed one that's wrong would
  actively mislead triage, which is worse. The dependency graph view will
  show Airflow-connected jobs with no edges between them until this is
  built.
- **No DAG-run-level "retrying".** Airflow retries happen per-task inside
  a DAG run, not to the run as a whole — there's no real signal at this
  granularity to map onto Schedio's `"retrying"` status. A DAG run that
  ultimately succeeds after an internal task retry just reads as a normal
  success.
- **Unusual custom cron schedules approximate to daily.** Schedio's model
  supports five fixed cadences (see the root `MISSION.md`); an arbitrary
  cron expression outside the common patterns this connector recognizes
  (see `cadence.ts`) can't be represented exactly and falls back rather
  than guessing wrong.
- **Unbounded concurrency for `dagRuns` fetches.** Every DAG's run history
  is fetched in parallel. Fine for the DAG counts most teams have; an
  instance with very many DAGs may want a concurrency cap in a future
  version.

## Testing

`npm run test` runs fixture-based tests (`node --test`, zero extra test
framework dependency) against the mapping functions and the full connector
factory with a fake `fetch` — no live Airflow instance required.
