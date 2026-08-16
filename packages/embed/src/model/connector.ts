import type { Job, Run, RunStatus, Schedule } from "./types";
import { CORE_PLATFORM_INCIDENT_ROOT_ID, JOBS, JOBS_BY_SCOPE } from "./seed-data";

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
const CADENCE_HOURS: Record<Job["schedule"]["cadence"], number> = {
  hourly: 1,
  every_6_hours: 6,
  daily: 24,
  weekly: 24 * 7,
  monthly: 24 * 30,
};

/** How far back to strip a job's history to guarantee it reads as overdue, regardless of its own cadence. */
function overdueStripHours(job: Job): number {
  return CADENCE_HOURS[job.schedule.cadence] + job.sla.graceMinutes / 60 + 24;
}

function transitiveDependentIds(rootId: string, jobs: Job[]): string[] {
  const dependents = new Map<string, string[]>();
  for (const job of jobs) {
    for (const depId of job.dependsOn) {
      const arr = dependents.get(depId) ?? [];
      arr.push(job.id);
      dependents.set(depId, arr);
    }
  }

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

export interface ConnectorSnapshot {
  jobs: Job[];
  runsByJobId: Map<string, Run[]>;
  reachableScopeIds: Set<string>;
  lastSyncedAt: string;
}

/**
 * The seam a real integration plugs into. A connector's only job is
 * producing a snapshot in the model's raw shape — everything downstream
 * (severity, rollup, copy) is computed identically regardless of where the
 * snapshot came from. Async because real connectors fetch over the network;
 * `getGlanceView`/`getJobDetail` await this even when a connector (like the
 * built-in mock) happens to resolve synchronously.
 */
export type ConnectorFn = (
  now: Date,
  reachabilityOverrides: Record<string, boolean>,
) => ConnectorSnapshot | Promise<ConnectorSnapshot>;

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
    runsByJobId,
    reachableScopeIds,
    lastSyncedAt: new Date(now.getTime() - 52 * MS).toISOString(),
  };
};
