import type { Job, Run, RunStatus, Schedule, Scope } from "./types";
import { CORE_PLATFORM_INCIDENT_ROOT_ID, JOBS, JOBS_BY_SCOPE, SCOPES } from "./seed-data";
import { buildDependentIdsMap } from "./graph-utils";
import { CADENCE_INTERVAL_MS } from "./compute";

/**
 * Stands in for a real scheduler connector (Airflow, Dagster, Temporal...).
 * Its only job is producing raw Job/Run data in the model's shape — nothing
 * downstream of this file should know or care that the data is synthetic.
 *
 * Scenarios are anchored to `now` rather than to jobs' literal schedule
 * hours, so the demo states (critical, recovering, missing, late) are
 * guaranteed visible whenever this is opened, not dependent on wall-clock
 * luck lining up with a job's schedule.
 */

const HISTORY_DAYS = 18;
const MS = 60_000;

// ---------------------------------------------------------------------------
// Deterministic per-job PRNG so a given job's random history is stable
// across re-renders within a session (avoids data "flickering" if this runs
// more than once, e.g. React dev double-invoke).
// ---------------------------------------------------------------------------

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ERROR_SUMMARIES = [
  "Connection to source database timed out",
  "Unexpected schema change in upstream table",
  "Out of memory during transform step",
  "Rate limited by third-party API",
  "Null value in a required field",
  "Downstream write target was locked",
];

function pickErrorSummary(rand: () => number): string {
  return ERROR_SUMMARIES[Math.floor(rand() * ERROR_SUMMARIES.length)];
}

// ---------------------------------------------------------------------------
// Schedule math: which timestamps a job is expected to run at within a range.
// ---------------------------------------------------------------------------

function occurrencesOnDay(schedule: Schedule, day: Date): Date[] {
  const y = day.getFullYear();
  const m = day.getMonth();
  const d = day.getDate();
  const out: Date[] = [];

  switch (schedule.cadence) {
    case "hourly":
      for (let h = 0; h < 24; h++) out.push(new Date(y, m, d, h, 0, 0));
      break;
    case "every_6_hours":
      for (let h = 0; h < 24; h += 6) out.push(new Date(y, m, d, h, 0, 0));
      break;
    case "daily":
      out.push(new Date(y, m, d, schedule.hour ?? 0, schedule.minute ?? 0, 0));
      break;
    case "weekly":
      if (day.getDay() === (schedule.weekday ?? 0)) {
        out.push(new Date(y, m, d, schedule.hour ?? 0, schedule.minute ?? 0, 0));
      }
      break;
    case "monthly":
      if (d === (schedule.dayOfMonth ?? 1)) {
        out.push(new Date(y, m, d, schedule.hour ?? 0, schedule.minute ?? 0, 0));
      }
      break;
  }
  return out;
}

export function getExpectedRunTimes(schedule: Schedule, rangeStart: Date, rangeEnd: Date): Date[] {
  const out: Date[] = [];
  const cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate());
  while (cursor <= rangeEnd) {
    for (const t of occurrencesOnDay(schedule, cursor)) {
      if (t >= rangeStart && t <= rangeEnd) out.push(t);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Bulk history generation
// ---------------------------------------------------------------------------

function generateRunsForJob(job: Job, now: Date): Run[] {
  const rand = mulberry32(hashSeed(job.id));
  const rangeStart = new Date(now.getTime() - HISTORY_DAYS * 24 * 60 * MS);
  const occurrences = getExpectedRunTimes(job.schedule, rangeStart, now);

  // Each job gets its own "personality" — a stable baseline failure rate
  // between 2% and 14%, so the normalcy signal has something real to say.
  const baseFailRate = 0.02 + (hashSeed(job.id + ":rate") % 100) / 100 * 0.12;

  return occurrences.map((scheduledAt) => {
    const startJitterMin = rand() * 3;
    const startedAt = new Date(scheduledAt.getTime() + startJitterMin * MS);
    const durationMin = job.sla.expectedDurationMinutes * (0.55 + rand() * 0.7);
    const endedAt = new Date(startedAt.getTime() + durationMin * MS);
    const stillRunning = endedAt > now;
    const failed = !stillRunning && rand() < baseFailRate;

    const status: RunStatus = stillRunning ? "running" : failed ? "failed" : "success";

    return {
      id: `${job.id}@${scheduledAt.toISOString()}`,
      jobId: job.id,
      scheduledAt: scheduledAt.toISOString(),
      startedAt: startedAt.toISOString(),
      endedAt: stillRunning ? undefined : endedAt.toISOString(),
      status,
      attempt: 1,
      errorSummary: failed ? pickErrorSummary(rand) : undefined,
    };
  });
}

// ---------------------------------------------------------------------------
// Scripted "hero" scenarios — guarantee every severity is demonstrable
// regardless of when the app happens to be opened.
// ---------------------------------------------------------------------------

interface ScenarioOverride {
  /** Remove any generated runs in [now - stripHours, now] before applying. */
  stripHours: number;
  /** If omitted, the job is left with a genuine gap (-> "missing"). */
  inject?: (now: Date, rand: () => number) => Run;
}

/**
 * Support Ops is deliberately guaranteed-healthy, the same way every other
 * scenario below guarantees its own severity: without this, whether it
 * happens to read as "healthy" would depend on random baseline generation
 * not landing a failure on the most recent run, and the plain healthy
 * headline state wouldn't be reliably demonstrable on every load.
 */
function healthyOverride(jobId: string, minutesAgo: number): ScenarioOverride {
  return {
    stripHours: 6,
    inject: (now) => {
      const scheduledAt = new Date(now.getTime() - minutesAgo * MS);
      return {
        id: `${jobId}@hero`,
        jobId,
        scheduledAt: scheduledAt.toISOString(),
        startedAt: scheduledAt.toISOString(),
        endedAt: new Date(scheduledAt.getTime() + 5 * MS).toISOString(),
        status: "success",
        attempt: 1,
      };
    },
  };
}

const SCENARIOS: Record<string, ScenarioOverride> = {
  "ticket-sla-sync": healthyOverride("ticket-sla-sync", 25),
  "kb-reindex": healthyOverride("kb-reindex", 40),
  "csat-rollup": healthyOverride("csat-rollup", 55),
  "escalation-digest": healthyOverride("escalation-digest", 70),

  // Failed, no retry, blocks two downstream jobs, well past its SLA -> critical.
  "build-revenue-facts": {
    stripHours: 30,
    inject: (now) => {
      const scheduledAt = new Date(now.getTime() - 3 * 60 * MS);
      const endedAt = new Date(now.getTime() - 130 * MS);
      return {
        id: `build-revenue-facts@hero`,
        jobId: "build-revenue-facts",
        scheduledAt: scheduledAt.toISOString(),
        startedAt: scheduledAt.toISOString(),
        endedAt: endedAt.toISOString(),
        status: "failed",
        attempt: 1,
        errorSummary: "Timed out connecting to the payments warehouse",
      };
    },
  },
  // Never ran because its upstream (build-revenue-facts) failed -> missing, blocked.
  "daily-exec-dashboard-refresh": { stripHours: 30 },

  // Failed once, automatic retry is currently in flight -> recovering.
  "reconcile-ledger": {
    stripHours: 6,
    inject: (now) => {
      const scheduledAt = new Date(now.getTime() - 22 * MS);
      return {
        id: `reconcile-ledger@hero`,
        jobId: "reconcile-ledger",
        scheduledAt: scheduledAt.toISOString(),
        startedAt: new Date(now.getTime() - 21 * MS).toISOString(),
        endedAt: undefined,
        status: "retrying",
        attempt: 2,
        errorSummary: "Connection reset partway through",
      };
    },
  },
  "chargeback-sync": {
    stripHours: 6,
    inject: (now) => {
      const scheduledAt = new Date(now.getTime() - 14 * MS);
      return {
        id: `chargeback-sync@hero`,
        jobId: "chargeback-sync",
        scheduledAt: scheduledAt.toISOString(),
        startedAt: new Date(now.getTime() - 13 * MS).toISOString(),
        endedAt: undefined,
        status: "retrying",
        attempt: 2,
        errorSummary: "Upstream rate limit, retry backed off",
      };
    },
  },

  // A clean gap: expected, nothing showed up -> missing.
  "attribution-model-run": { stripHours: 30 },

  // Still running, well past expected duration + grace -> late.
  "lead-scoring-batch": {
    stripHours: 6,
    inject: (now) => {
      const scheduledAt = new Date(now.getTime() - 70 * MS);
      return {
        id: `lead-scoring-batch@hero`,
        jobId: "lead-scoring-batch",
        scheduledAt: scheduledAt.toISOString(),
        startedAt: new Date(now.getTime() - 68 * MS).toISOString(),
        endedAt: undefined,
        status: "running",
        attempt: 1,
      };
    },
  },

  // Failed, no retry, doesn't block anything, still fresh -> needs_attention.
  "detect-fraud-signals": {
    stripHours: 6,
    inject: (now) => {
      const scheduledAt = new Date(now.getTime() - 18 * MS);
      return {
        id: `detect-fraud-signals@hero`,
        jobId: "detect-fraud-signals",
        scheduledAt: scheduledAt.toISOString(),
        startedAt: new Date(now.getTime() - 17 * MS).toISOString(),
        endedAt: new Date(now.getTime() - 10 * MS).toISOString(),
        status: "failed",
        attempt: 1,
        errorSummary: "Unexpected null in fraud score payload",
      };
    },
  },
};

/**
 * Core Platform's incident: `CORE_PLATFORM_INCIDENT_ROOT_ID` fails outright,
 * and every job downstream of it (any number of hops away) shows as
 * "missing" — it genuinely never got fresh input, so it genuinely never
 * ran. The affected set is computed by walking `dependsOn` forward from the
 * root rather than hand-listed, since a ~60-job pipeline is exactly the
 * scale at which a hand-maintained list of "everything downstream of X"
 * silently drifts out of date.
 */
/** How far back to strip a job's history to guarantee it reads as overdue, regardless of its own cadence. */
function overdueStripHours(job: Job): number {
  const cadenceHours = CADENCE_INTERVAL_MS[job.schedule.cadence] / (60 * 60 * 1000);
  return cadenceHours + job.sla.graceMinutes / 60 + 24;
}

function transitiveDependentIds(rootId: string, jobs: Job[]): string[] {
  const dependents = buildDependentIdsMap(jobs);

  const affected: string[] = [];
  const seen = new Set<string>([rootId]);
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const childId of dependents.get(id) ?? []) {
      if (!seen.has(childId)) {
        seen.add(childId);
        affected.push(childId);
        queue.push(childId);
      }
    }
  }
  return affected;
}

function buildIncidentScenarios(): Record<string, ScenarioOverride> {
  const jobsById = new Map(JOBS.map((j) => [j.id, j]));
  const root = jobsById.get(CORE_PLATFORM_INCIDENT_ROOT_ID);
  if (!root) return {};

  const scenarios: Record<string, ScenarioOverride> = {
    [root.id]: {
      stripHours: 6,
      inject: (now) => {
        const scheduledAt = new Date(now.getTime() - 180 * MS);
        const endedAt = new Date(now.getTime() - 130 * MS);
        return {
          id: `${root.id}@hero`,
          jobId: root.id,
          scheduledAt: scheduledAt.toISOString(),
          startedAt: scheduledAt.toISOString(),
          endedAt: endedAt.toISOString(),
          status: "failed",
          attempt: 1,
          errorSummary: "Upstream order stream API returned 5xx for an extended window",
        };
      },
    },
  };

  for (const jobId of transitiveDependentIds(root.id, JOBS)) {
    const job = jobsById.get(jobId)!;
    scenarios[jobId] = { stripHours: overdueStripHours(job) };
  }
  return scenarios;
}

const ALL_SCENARIOS: Record<string, ScenarioOverride> = { ...SCENARIOS, ...buildIncidentScenarios() };

function applyScenario(jobId: string, runs: Run[], now: Date): Run[] {
  const scenario = ALL_SCENARIOS[jobId];
  if (!scenario) return runs;

  const cutoff = now.getTime() - scenario.stripHours * 60 * MS;
  const kept = runs.filter((r) => new Date(r.scheduledAt).getTime() < cutoff);
  if (scenario.inject) {
    const rand = mulberry32(hashSeed(jobId + ":hero"));
    kept.push(scenario.inject(now, rand));
  }
  return kept;
}

// ---------------------------------------------------------------------------
// Connector reachability — which scopes currently have fresh data.
// ---------------------------------------------------------------------------

const DEFAULT_UNREACHABLE_SCOPES = new Set(["infrastructure"]);
/** Scopes with a real connector but genuinely zero history yet (newly onboarded). */
const NO_HISTORY_SCOPES = new Set(["ml-platform"]);
/** Low-frequency scope used to demonstrate "nothing scheduled in this window". */
const SPARSE_CADENCE_SCOPE = "quarterly-ops";

/**
 * Quarterly Ops jobs are monthly, and a literal `dayOfMonth` will
 * occasionally land on today's real calendar date by pure coincidence —
 * which would make the "empty state" demo scope flip to "has an exception"
 * on some days for reasons that have nothing to do with the scenario it's
 * meant to demonstrate. Anchor its due date ~15 days from today instead of
 * a fixed day-of-month, so the scope reliably reads as empty for the
 * since-midnight/24h/7d windows regardless of which real day this is
 * opened on.
 */
function effectiveJob(job: Job, now: Date): Job {
  if (job.scopeId !== SPARSE_CADENCE_SCOPE) return job;
  const safeDay = ((now.getDate() + 14) % 28) + 1;
  return { ...job, schedule: { ...job.schedule, dayOfMonth: safeDay } };
}

/** One source's own sync/reachability, as reported inside a combined snapshot — see `combineConnectors`. */
export interface ConnectorSourceStatus {
  reachable: boolean;
  /** Absent if this source's fetch failed outright — there's no sync time to report. */
  lastSyncedAt?: string;
  /** This source's own scope ids, already namespaced — lets a consumer attribute a scope back to its source. */
  scopeIds: string[];
}

export interface ConnectorSnapshot {
  jobs: Job[];
  /**
   * A connector reports its own scopes — this is what a team/tag/instance
   * *is*, according to whichever backend produced this snapshot. Nothing
   * downstream (compute.ts, components) hardcodes a scope list; the mock
   * connector's own `SCOPES` fixture is just the first thing to satisfy
   * this contract, not special-cased.
   */
  scopes: Scope[];
  runsByJobId: Map<string, Run[]>;
  reachableScopeIds: Set<string>;
  /** The whole snapshot's sync time — for a single connector, its own; for a combined one, the oldest of its sources. */
  lastSyncedAt: string;
  /**
   * Present only on a snapshot produced by `combineConnectors` — one entry
   * per source, keyed the same way the caller keyed it. A snapshot from a
   * single connector has exactly one source (itself), so the top-level
   * `reachableScopeIds`/`lastSyncedAt` already tell the whole story and
   * this is omitted rather than populated with a redundant single entry.
   */
  sources?: Record<string, ConnectorSourceStatus>;
}

/**
 * The seam a real integration plugs into. A connector's only job is
 * producing a snapshot in the model's raw shape — everything downstream
 * (severity, rollup, copy) is computed identically regardless of where the
 * snapshot came from. Async because real connectors fetch over the network;
 * `getGlanceView`/`getJobDetail` await this even when a connector (like the
 * built-in mock) happens to resolve synchronously.
 *
 * `pollIntervalMs` is how this *specific* connector wants to be re-polled
 * for fresh data — set it once where the connector itself is configured
 * (e.g. `createAirflowConnector({ pollIntervalMs: 45_000 })`) rather than
 * threading a matching prop through every component that might render it.
 * Omit to use `DEFAULT_POLL_INTERVAL_MS`; set to `0` to disable polling
 * for this connector entirely. See `resolvePollIntervalMs`.
 */
export type ConnectorFn = ((
  now: Date,
  reachabilityOverrides: Record<string, boolean>,
) => ConnectorSnapshot | Promise<ConnectorSnapshot>) & {
  pollIntervalMs?: number;
};

/** Every UI component polls at this cadence by default — see `ConnectorFn.pollIntervalMs` to change it per connector. */
export const DEFAULT_POLL_INTERVAL_MS = 30_000;

/**
 * A connector's effective poll interval: its own `pollIntervalMs` if it
 * set one (`0` disables polling entirely), otherwise the default. Reads a
 * plain function value fine too (`pollIntervalMs` simply isn't set) — a
 * connector author doesn't have to opt into this to get the default 30s
 * cadence, only to change or disable it.
 */
export function resolvePollIntervalMs(connector: ConnectorFn): number {
  if (connector.pollIntervalMs === 0) return 0;
  return connector.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
}

export const mockConnector: ConnectorFn = (now, reachabilityOverrides = {}): ConnectorSnapshot => {
  const runsByJobId = new Map<string, Run[]>();
  const jobs = JOBS.map((job) => effectiveJob(job, now));

  for (const job of jobs) {
    if (NO_HISTORY_SCOPES.has(job.scopeId)) {
      runsByJobId.set(job.id, []);
      continue;
    }
    const generated = generateRunsForJob(job, now);
    runsByJobId.set(job.id, applyScenario(job.id, generated, now));
  }

  const reachableScopeIds = new Set(Object.keys(JOBS_BY_SCOPE));
  for (const scopeId of DEFAULT_UNREACHABLE_SCOPES) reachableScopeIds.delete(scopeId);
  for (const [scopeId, reachable] of Object.entries(reachabilityOverrides)) {
    if (reachable) reachableScopeIds.add(scopeId);
    else reachableScopeIds.delete(scopeId);
  }

  return {
    jobs,
    scopes: SCOPES,
    runsByJobId,
    reachableScopeIds,
    lastSyncedAt: new Date(now.getTime() - 52 * MS).toISOString(),
  };
};

// ---------------------------------------------------------------------------
// combineConnectors — merges N connectors' snapshots into one. This is the
// seam that turns "one Airflow" into "several Airflow instances, or several
// different backends, viewed together" without GlanceView/JobDetail/
// PipelineGraphView changing at all: they still only ever see one
// ConnectorFn. See MISSION.md's "migration mode is first-class" and the
// connector architecture design doc for the full reasoning.
// ---------------------------------------------------------------------------

function namespaceJob(key: string, job: Job): Job {
  return {
    ...job,
    id: `${key}:${job.id}`,
    scopeId: `${key}:${job.scopeId}`,
    dependsOn: job.dependsOn.map((id) => `${key}:${id}`),
  };
}

function namespaceRuns(key: string, jobId: string, runs: Run[]): Run[] {
  return runs.map((run) => ({ ...run, jobId: `${key}:${jobId}` }));
}

/**
 * Combines several connectors into one, keyed by whatever name the caller
 * gives each — e.g. `combineConnectors({ "airflow-prod": ..., "airflow-staging": ... })`.
 *
 * Every job/scope id is re-namespaced by its source's key here, regardless
 * of whatever id scheme (if any) the connector itself already uses.
 * combineConnectors owns global uniqueness itself rather than trusting each
 * connector to self-namespace correctly — a mismatch between a connector's
 * own internal identity and the key it happens to be registered under here
 * would otherwise silently corrupt the merge (two sources' jobs colliding
 * in one Map), which is a much worse failure mode than combineConnectors
 * just doing the renaming itself, once, in the one place that has to get
 * it right.
 *
 * Each source's own "all" (aggregate) scope is dropped — only its "team"
 * scopes carry through. The merged result doesn't need its own synthetic
 * "all" scope here: the model layer (`prepareData` in model/index.ts)
 * guarantees exactly one on every snapshot it prepares, single-connector
 * or combined alike, so that contract lives in one place, not duplicated
 * here.
 *
 * A source that fails outright (a thrown/rejected fetch, not a well-behaved
 * connector reporting its own scopes as unreachable) doesn't take the
 * merge down with it — Promise.allSettled means one bad source is marked
 * unreachable in `sources` and simply contributes nothing, while every
 * other source's data still renders normally.
 */
export function combineConnectors(connectors: Record<string, ConnectorFn>): ConnectorFn {
  const keys = Object.keys(connectors);

  const combined: ConnectorFn = async (now, reachabilityOverrides) => {
    // Override keys arrive in the *merged* namespace (e.g.
    // "airflow-prod:data-platform" — whatever a caller like the built-in
    // outage-simulation UI read back from this combined snapshot's own
    // scopes), but each source's own connector only knows its own
    // unprefixed scope ids. Unprefix per source before forwarding, so an
    // override actually reaches the source it's meant for instead of
    // silently matching nothing.
    const settled = await Promise.allSettled(
      keys.map((key) => {
        const prefix = `${key}:`;
        const ownOverrides = Object.fromEntries(
          Object.entries(reachabilityOverrides)
            .filter(([scopeId]) => scopeId.startsWith(prefix))
            .map(([scopeId, reachable]) => [scopeId.slice(prefix.length), reachable]),
        );
        return connectors[key](now, ownOverrides);
      }),
    );

    const jobs: Job[] = [];
    // Each source's own "all" scope is dropped below (only "team" scopes
    // carry through) — the model layer guarantees a single canonical "all"
    // scope on every snapshot it prepares, so combineConnectors doesn't
    // need to synthesize its own here too.
    const scopes: Scope[] = [];
    const runsByJobId = new Map<string, Run[]>();
    const reachableScopeIds = new Set<string>();
    const sources: Record<string, ConnectorSourceStatus> = {};
    const syncTimesMs: number[] = [];

    keys.forEach((key, i) => {
      const result = settled[i];
      if (result.status === "rejected") {
        sources[key] = { reachable: false, scopeIds: [] };
        return;
      }

      const snapshot = result.value;
      const teamScopes = snapshot.scopes.filter((s) => s.kind !== "all");
      const namespacedScopeIds = new Set(teamScopes.map((s) => `${key}:${s.id}`));

      for (const scope of teamScopes) scopes.push({ ...scope, id: `${key}:${scope.id}` });
      for (const job of snapshot.jobs) jobs.push(namespaceJob(key, job));
      for (const [jobId, runs] of snapshot.runsByJobId) {
        runsByJobId.set(`${key}:${jobId}`, namespaceRuns(key, jobId, runs));
      }
      for (const scopeId of snapshot.reachableScopeIds) {
        const namespacedId = `${key}:${scopeId}`;
        if (namespacedScopeIds.has(namespacedId)) reachableScopeIds.add(namespacedId);
      }

      // "reachable" here means the connector's own fetch succeeded, full
      // stop — not "and every one of its scopes is currently up". Those
      // are different questions: which specific scopes are degraded is
      // already fully answered by the merged `reachableScopeIds` (cross-
      // reference against this source's own `scopeIds` below). Folding
      // "one of eight scopes is down" into a single false here would
      // make a source with a scripted partial outage look completely
      // dead, which is exactly the information loss per-source tracking
      // exists to avoid.
      sources[key] = { reachable: true, lastSyncedAt: snapshot.lastSyncedAt, scopeIds: [...namespacedScopeIds] };
      syncTimesMs.push(new Date(snapshot.lastSyncedAt).getTime());
    });

    // Most conservative combined value: never claim the merge is fresher
    // than its stalest successful source. If every source failed outright,
    // there's no real sync time to report — falling back to `now` here is
    // a defensive last resort (a well-behaved connector shouldn't throw),
    // not a claim that anything actually synced.
    const lastSyncedAt = syncTimesMs.length > 0 ? new Date(Math.min(...syncTimesMs)).toISOString() : now.toISOString();

    return { jobs, scopes, runsByJobId, reachableScopeIds, lastSyncedAt, sources };
  };

  // Poll at whichever active source wants to be polled fastest — a source
  // that stayed silent about it implicitly wants the default cadence too,
  // same as any other connector; only an explicit `0` opts a source out.
  // The combined result is only fully non-polling if every source is.
  const activeIntervals = Object.values(connectors).map(resolvePollIntervalMs).filter((ms) => ms > 0);
  combined.pollIntervalMs = activeIntervals.length > 0 ? Math.min(...activeIntervals) : 0;

  return combined;
}

// ---------------------------------------------------------------------------
// withScopeAccess — the RBAC seam. A host doesn't hand Schedio a role or a
// login; it hands it the one thing Schedio actually needs, the resolved set
// of scope ids the current viewer may see, and this wrapper enforces it the
// same way combineConnectors merges: by transforming ConnectorFn -> ConnectorFn,
// so nothing in compute.ts or any component has to know access control
// exists at all.
// ---------------------------------------------------------------------------

/**
 * Filters a connector's snapshot down to only `allowedScopeIds` before it
 * ever reaches `compute.ts` (or a component) — never a UI hide layered on
 * top of unfiltered data. Restricted scopes never reach Schedio's rendered
 * UI or React state, full stop.
 *
 * How strong a guarantee that actually is depends on *where* `connector`
 * itself runs, because `GlanceView`/`JobDetail` are client components that
 * call it directly in the browser. Wrap it there (the default, works with
 * zero setup) and this is real filtering plus a real UX guarantee, but a
 * technically curious viewer with dev tools open could still see the
 * connector's raw network response before this function discards the
 * disallowed parts — the same way any client-side check can be inspected.
 * For a real security boundary against that, call the connector (with this
 * wrapper) somewhere the viewer can't inspect the traffic — a Next.js
 * Server Component or API route the client-side `ConnectorFn` calls
 * instead of hitting the backend directly — so the unfiltered response
 * never crosses the network to the browser at all. Either placement
 * composes identically; this function doesn't care which.
 *
 * The other case this matters for: a backend that already authenticates
 * per-user (the viewer's own Airflow credentials, not one shared
 * admin-configured token) and enforces its own access control makes this
 * wrapper redundant defense-in-depth rather than the only guard — also
 * unaffected by where it runs.
 *
 * `"all"` is a pass-through (every scope visible, unchanged) — the common
 * case for an unrestricted viewer, without a caller needing to enumerate
 * every scope id that might ever exist.
 *
 * A restricted scope disappears entirely — not just its jobs, but any trace
 * that it exists: its own scope entry, and any `dependsOn` edge a visible
 * job had pointing into it (silently dropped, the same "an honest gap beats
 * a misleading edge" call `@schedio/connector-airflow` makes for
 * dependencies it can't map — a raw id from a scope you can't see would
 * otherwise leak into `JobDetailView.dependsOnNames` and crash the
 * dependency graph, which builds every node from a `statusMap` that no
 * longer has an entry for it).
 *
 * Composable with `combineConnectors` in either order: wrap a single
 * source's connector before combining it (scope ids in that source's own,
 * unprefixed namespace) or wrap the already-combined connector (scope ids
 * in the merged, prefixed namespace) — whichever matches the shape the
 * caller's scope ids are already in.
 */
export function withScopeAccess(connector: ConnectorFn, allowedScopeIds: "all" | string[]): ConnectorFn {
  if (allowedScopeIds === "all") return connector;
  const allowed = new Set(allowedScopeIds);

  const scoped: ConnectorFn = async (now, reachabilityOverrides) => {
    const snapshot = await connector(now, reachabilityOverrides);

    // Drop any "all" scope the connector reported itself — it aggregated
    // over jobs some of which are about to disappear, so it's stale;
    // prepareData() synthesizes a fresh one over exactly what's left.
    const scopes = snapshot.scopes.filter((s) => s.kind !== "all" && allowed.has(s.id));
    const visibleJobs = snapshot.jobs.filter((j) => allowed.has(j.scopeId));
    const visibleJobIds = new Set(visibleJobs.map((j) => j.id));
    const jobs = visibleJobs.map((j) => ({ ...j, dependsOn: j.dependsOn.filter((id) => visibleJobIds.has(id)) }));
    const runsByJobId = new Map([...snapshot.runsByJobId].filter(([jobId]) => visibleJobIds.has(jobId)));
    const reachableScopeIds = new Set([...snapshot.reachableScopeIds].filter((id) => allowed.has(id)));

    // If this snapshot came from combineConnectors, don't let a source
    // whose scopes are entirely hidden still announce its own existence
    // (reachability, sync time) through `sources` — same "no trace" rule
    // as everything else here.
    const sources = snapshot.sources
      ? Object.fromEntries(
          Object.entries(snapshot.sources)
            .map(([key, status]): [string, ConnectorSourceStatus] => [
              key,
              { ...status, scopeIds: status.scopeIds.filter((id) => allowed.has(id)) },
            ])
            .filter(([, status]) => status.scopeIds.length > 0),
        )
      : undefined;

    return { ...snapshot, scopes, jobs, runsByJobId, reachableScopeIds, sources };
  };

  // Forward the wrapped connector's own polling preference unchanged (unset
  // included) — filtering who can see a connector's data shouldn't change
  // how often it's polled.
  if (connector.pollIntervalMs !== undefined) scoped.pollIntervalMs = connector.pollIntervalMs;

  return scoped;
}
