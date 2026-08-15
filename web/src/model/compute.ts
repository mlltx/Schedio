import type {
  HeadlineKind,
  Job,
  JobStatus,
  Run,
  Severity,
  TimeWindow,
  TrendPoint,
} from "./types";

/**
 * All triage logic lives here, in exactly one place, so it behaves
 * identically no matter which connector produced the raw data. The UI must
 * never re-derive any of this from raw runs — it only ever reads the
 * outputs of this file.
 */

const MS = 60_000;

const CADENCE_INTERVAL_MS: Record<Job["schedule"]["cadence"], number> = {
  hourly: 60 * MS,
  every_6_hours: 6 * 60 * MS,
  daily: 24 * 60 * MS,
  weekly: 7 * 24 * 60 * MS,
  monthly: 30 * 24 * 60 * MS,
};

export const CADENCE_LABEL: Record<Job["schedule"]["cadence"], string> = {
  hourly: "Hourly",
  every_6_hours: "Every 6 hours",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

export function windowStart(window: TimeWindow, now: Date): Date {
  switch (window) {
    case "since_midnight":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    case "last_24h":
      return new Date(now.getTime() - 24 * 60 * MS);
    case "last_7d":
      return new Date(now.getTime() - 7 * 24 * 60 * MS);
  }
}

export function formatRelative(iso: string | undefined, now: Date): string {
  if (!iso) return "";
  const diffMs = now.getTime() - new Date(iso).getTime();
  const diffMin = Math.round(diffMs / MS);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
}

export function formatClock(iso: string | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function formatDurationMinutes(min: number): string {
  if (min < 60) return `${Math.round(min)}m`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ---------------------------------------------------------------------------
// Per-job classification
// ---------------------------------------------------------------------------

interface ClassifyInput {
  job: Job;
  runs: Run[];
  now: Date;
  /** Plain names of jobs that list this job in their dependsOn. */
  dependentNames: string[];
  /** Plain names of upstream jobs (from this job's own dependsOn) currently failed/critical. */
  failedUpstreamNames: string[];
}

export function classifyJob({
  job,
  runs,
  now,
  dependentNames,
  failedUpstreamNames,
}: ClassifyInput): JobStatus {
  const base = {
    jobId: job.id,
    jobName: job.name,
    owner: job.owner,
    scopeId: job.scopeId,
    blocksDownstream: dependentNames,
    hasHistory: runs.length > 0,
  };

  if (runs.length === 0) {
    return {
      ...base,
      severity: "unknown",
      headline: "No history yet",
      detail: `${job.name} was connected recently and hasn't reported a run yet. This isn't a failure — there's just nothing to show.`,
      baseline: { failureRatePercent: 0, isTypicalToday: true },
    };
  }

  const sorted = [...runs].sort(
    (a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime(),
  );
  const latest = sorted[0];
  const graceMs = job.sla.graceMinutes * MS;
  const expectedDurationMs = job.sla.expectedDurationMinutes * MS;
  const baseline = computeBaseline(runs, now);

  const latestRunView = {
    status: latest.status,
    scheduledAt: latest.scheduledAt,
    startedAt: latest.startedAt,
    endedAt: latest.endedAt,
    errorSummary: latest.errorSummary,
  };

  let severity: Severity;
  let headline: string;
  let detail: string;

  switch (latest.status) {
    case "running": {
      const elapsed = now.getTime() - new Date(latest.startedAt ?? latest.scheduledAt).getTime();
      if (elapsed > expectedDurationMs + graceMs) {
        severity = "late";
        headline = "Running later than expected";
        detail = `Started ${formatRelative(latest.startedAt, now)} and is still going — that's past its usual ${formatDurationMinutes(job.sla.expectedDurationMinutes)} runtime.`;
      } else {
        severity = "healthy";
        headline = "Running on schedule";
        detail = `Started ${formatRelative(latest.startedAt, now)} and is still within its normal runtime.`;
      }
      break;
    }
    case "retrying": {
      severity = "recovering";
      headline = "Hit a snag, retrying now";
      detail = `Failed on the first attempt and an automatic retry started ${formatRelative(latest.startedAt, now)}. No action needed unless it fails again.`;
      break;
    }
    case "failed": {
      const staleMs = now.getTime() - new Date(latest.endedAt ?? latest.scheduledAt).getTime();
      const blocking = dependentNames.length > 0;
      if (blocking && staleMs > graceMs) {
        severity = "critical";
        headline = `Failed and is blocking ${dependentNames.length === 1 ? dependentNames[0] : `${dependentNames.length} other jobs`}`;
        detail = `Failed ${formatRelative(latest.endedAt, now)} with no retry, and is now well past its expected completion time. This is holding up: ${dependentNames.join(", ")}.`;
      } else if (blocking) {
        severity = "needs_attention";
        headline = `Failed — blocks ${dependentNames.length === 1 ? dependentNames[0] : `${dependentNames.length} other jobs`}`;
        detail = `Failed ${formatRelative(latest.endedAt, now)} with no retry in progress. It hasn't been broken long, but it's blocking: ${dependentNames.join(", ")}.`;
      } else {
        severity = "needs_attention";
        headline = "Didn't finish";
        detail = `Failed ${formatRelative(latest.endedAt, now)} with no retry in progress.${latest.errorSummary ? ` ${latest.errorSummary}.` : ""}`;
      }
      break;
    }
    case "success": {
      const nextDue = new Date(latest.scheduledAt).getTime() + CADENCE_INTERVAL_MS[job.schedule.cadence];
      const overdue = now.getTime() > nextDue + graceMs;
      if (overdue) {
        severity = "missing";
        if (failedUpstreamNames.length > 0) {
          headline = `Waiting on ${failedUpstreamNames[0]}`;
          detail = `Hasn't run yet — it depends on ${failedUpstreamNames.join(", ")}, which failed and hasn't recovered.`;
        } else {
          headline = "Didn't run";
          detail = `Expected around ${formatClock(new Date(nextDue).toISOString())}; nothing has started yet.`;
        }
      } else {
        severity = "healthy";
        headline = "Ran on schedule";
        detail = `Finished ${formatRelative(latest.endedAt, now)}, right on schedule.`;
      }
      break;
    }
  }

  return { ...base, severity, headline, detail, latestRun: latestRunView, baseline };
}

function computeBaseline(runs: Run[], now: Date): { failureRatePercent: number; isTypicalToday: boolean } {
  const completed = runs.filter((r) => r.status === "success" || r.status === "failed");
  const failed = completed.filter((r) => r.status === "failed").length;
  const failureRatePercent = completed.length > 0 ? Math.round((100 * failed) / completed.length) : 0;

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayRuns = completed.filter((r) => new Date(r.scheduledAt) >= startOfToday);
  const todayFailed = todayRuns.filter((r) => r.status === "failed").length;
  const expectedFailuresToday = todayRuns.length * (failureRatePercent / 100);
  const isTypicalToday = todayFailed <= Math.ceil(expectedFailuresToday) + 1;

  return { failureRatePercent, isTypicalToday };
}

// ---------------------------------------------------------------------------
// Whether an exception is relevant to the selected time window. Ongoing
// conditions (missing/late/recovering) are always "now", so they always
// qualify; a stale, un-retried failure is gated by when it actually failed.
// ---------------------------------------------------------------------------

export function isExceptionInWindow(status: JobStatus, latestRun: Run | undefined, start: Date): boolean {
  if (status.severity === "healthy" || status.severity === "unknown") return false;
  if (status.severity === "missing" || status.severity === "late" || status.severity === "recovering") {
    return true;
  }
  const eventTime = latestRun?.endedAt ?? latestRun?.scheduledAt;
  if (!eventTime) return true;
  return new Date(eventTime) >= start;
}

// ---------------------------------------------------------------------------
// Scope-level rollup
// ---------------------------------------------------------------------------

export const SEVERITY_RANK: Severity[] = [
  "critical",
  "outage",
  "needs_attention",
  "missing",
  "late",
  "recovering",
  "healthy",
  "unknown",
];

export function worstSeverity(statuses: JobStatus[]): Severity {
  for (const s of SEVERITY_RANK) {
    if (statuses.some((j) => j.severity === s)) return s;
  }
  return "healthy";
}

export function headlineKindFor(
  jobStatuses: JobStatus[],
  connectorReachable: boolean,
  emptyForWindow: boolean,
): HeadlineKind {
  if (!connectorReachable) return "unreachable";
  if (jobStatuses.length > 0 && jobStatuses.every((j) => j.severity === "unknown")) return "no_data";
  if (emptyForWindow) return "empty";

  const worst = worstSeverity(jobStatuses.filter((j) => j.severity !== "unknown"));
  if (worst === "critical") return "critical";
  if (worst === "healthy") return "healthy";
  // "outage" (a child scope is unreachable) and every ordinary exception
  // both read as "needs a look" at this level — true "critical" red is
  // reserved for a confirmed failing+blocking job, not for uncertainty.
  return "needs_attention";
}

export function headlineCopyFor(
  kind: HeadlineKind,
  scopeName: string,
  exceptionCount: number,
  totalJobs: number,
  healthyCount: number,
  trendCopy: string,
  lastSyncedRelative: string,
  criticalExceptions: JobStatus[] = [],
): { headlineCopy: string; subCopy: string } {
  switch (kind) {
    case "healthy":
      return {
        headlineCopy: `${scopeName} looks healthy`,
        subCopy: `${healthyCount} of ${totalJobs} jobs on track — ${trendCopy}`,
      };
    case "needs_attention":
      return {
        headlineCopy: `${scopeName} needs a look`,
        subCopy: `${exceptionCount} job${exceptionCount === 1 ? "" : "s"} need${exceptionCount === 1 ? "s" : ""} attention — ${trendCopy}`,
      };
    case "critical": {
      const rest = exceptionCount - criticalExceptions.length;
      const namedPart =
        criticalExceptions.length === 1
          ? `${criticalExceptions[0].jobName} failed and is blocking other work`
          : `${criticalExceptions.length} jobs have failed and are blocking other work`;
      return {
        headlineCopy: `${scopeName} needs attention now`,
        subCopy: rest > 0 ? `${namedPart} — ${rest} more job${rest === 1 ? "" : "s"} also need${rest === 1 ? "s" : ""} a look` : namedPart,
      };
    }
    case "unreachable":
      return {
        headlineCopy: `Can't confirm status for ${scopeName}`,
        subCopy: `Lost contact ${lastSyncedRelative} — showing what we last knew below`,
      };
    case "no_data":
      return {
        headlineCopy: `No data yet for ${scopeName}`,
        subCopy: `This scope was connected recently and hasn't reported anything yet`,
      };
    case "empty":
      return {
        headlineCopy: `Nothing scheduled for ${scopeName}`,
        subCopy: `No jobs are due in this window — that's expected, not a problem`,
      };
  }
}

// ---------------------------------------------------------------------------
// Trend / normalcy
// ---------------------------------------------------------------------------

export function computeTrend(
  scopeName: string,
  allRunsInScope: Run[],
  now: Date,
  days = 14,
): { trend: TrendPoint[]; trendCopy: string } {
  const points: TrendPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * MS);
    const dayRuns = allRunsInScope.filter((r) => {
      const t = new Date(r.scheduledAt);
      return t >= dayStart && t < dayEnd && (r.status === "success" || r.status === "failed");
    });
    points.push({
      date: dayStart.toISOString(),
      failedCount: dayRuns.filter((r) => r.status === "failed").length,
      totalCount: dayRuns.length,
    });
  }

  const today = points[points.length - 1];
  const priorDays = points.slice(0, -1).filter((p) => p.totalCount > 0);
  const avgPriorFailed =
    priorDays.length > 0 ? priorDays.reduce((sum, p) => sum + p.failedCount, 0) / priorDays.length : 0;

  let trendCopy: string;
  if (today.totalCount === 0) {
    trendCopy = "nothing due yet today";
  } else if (avgPriorFailed === 0 && today.failedCount === 0) {
    trendCopy = `typical for ${scopeName}`;
  } else if (today.failedCount <= avgPriorFailed * 1.5 + 1) {
    trendCopy = `typical for ${scopeName}`;
  } else {
    trendCopy = "more failures than usual today";
  }

  return { trend: points, trendCopy };
}
