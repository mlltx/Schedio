import type {
  Job,
  JobDetailView,
  JobStatus,
  Run,
  Scope,
  ScopeStatus,
  TimeWindow,
} from "./types";
import { SCOPES } from "./seed-data";
import { fetchConnectorSnapshot, getExpectedRunTimes, type ConnectorSnapshot } from "./connector";
import {
  CADENCE_LABEL,
  SEVERITY_RANK,
  classifyJob,
  computeTrend,
  formatDurationMinutes,
  formatRelative,
  headlineCopyFor,
  headlineKindFor,
  isExceptionInWindow,
  windowStart,
} from "./compute";

/**
 * This module is the model layer's public API. Nothing outside src/model/
 * may import from ./types, ./connector, or ./compute directly — only from
 * here. That boundary is what makes "the UI never talks to a scheduler
 * directly" true rather than aspirational: swapping the mock connector for
 * a real one only ever means changing connector.ts.
 */

export type {
  HeadlineKind,
  JobDetailView,
  JobStatus,
  Scope,
  ScopeStatus,
  Severity,
  TimeWindow,
  TrendPoint,
} from "./types";

export function getScopes(): Scope[] {
  return SCOPES;
}

function buildDependentsMap(jobs: Job[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const job of jobs) {
    for (const depId of job.dependsOn) {
      const arr = map.get(depId) ?? [];
      arr.push(job.name);
      map.set(depId, arr);
    }
  }
  return map;
}

function classifyAllJobs(snapshot: ConnectorSnapshot, now: Date): Map<string, JobStatus> {
  const dependentsMap = buildDependentsMap(snapshot.jobs);

  const withoutUpstream = new Map<string, JobStatus>();
  for (const job of snapshot.jobs) {
    const runs = snapshot.runsByJobId.get(job.id) ?? [];
    withoutUpstream.set(
      job.id,
      classifyJob({
        job,
        runs,
        now,
        dependentNames: dependentsMap.get(job.id) ?? [],
        failedUpstreamNames: [],
      }),
    );
  }

  const jobsById = new Map(snapshot.jobs.map((j) => [j.id, j]));
  const final = new Map<string, JobStatus>();
  for (const job of snapshot.jobs) {
    const runs = snapshot.runsByJobId.get(job.id) ?? [];
    const failedUpstreamNames = job.dependsOn
      .map((depId) => withoutUpstream.get(depId))
      .filter((s): s is JobStatus => !!s && (s.severity === "critical" || s.severity === "needs_attention"))
      .map((s) => jobsById.get(s.jobId)!.name);

    final.set(
      job.id,
      classifyJob({
        job,
        runs,
        now,
        dependentNames: dependentsMap.get(job.id) ?? [],
        failedUpstreamNames,
      }),
    );
  }
  return final;
}

export interface GlanceViewOptions {
  /** Per-scope connector reachability overrides, for the outage-simulation toggle. */
  reachabilityOverrides?: Record<string, boolean>;
  /** Injectable for testing; defaults to the real current time. */
  now?: Date;
}

export function getGlanceView(scopeId: string, window: TimeWindow, options: GlanceViewOptions = {}): ScopeStatus {
  const now = options.now ?? new Date();
  const snapshot = fetchConnectorSnapshot(now, options.reachabilityOverrides ?? {});
  const statusMap = classifyAllJobs(snapshot, now);

  const scope = SCOPES.find((s) => s.id === scopeId) ?? SCOPES[0];
  const scopeJobs =
    scopeId === "all" ? snapshot.jobs.filter((j) => j.scopeId !== "all") : snapshot.jobs.filter((j) => j.scopeId === scopeId);

  const isAggregate = scopeId === "all";
  const childScopeIds = [...new Set(scopeJobs.map((j) => j.scopeId))];
  const unreachableChildScopes = childScopeIds
    .filter((id) => !snapshot.reachableScopeIds.has(id))
    .map((id) => ({ id, name: SCOPES.find((s) => s.id === id)?.name ?? id }));
  // "All" is an aggregate of several connectors, not a connector itself —
  // one child scope going dark is a partial-outage exception (handled
  // below via a synthetic row), not grounds for the whole aggregate to
  // read as "can't confirm anything". That banner is reserved for viewing
  // an unreachable scope directly.
  const ownConnectorReachable = isAggregate ? true : snapshot.reachableScopeIds.has(scopeId);

  const jobStatuses = scopeJobs.map((j) => statusMap.get(j.id)!).filter(Boolean);
  const start = windowStart(window, now);

  const nonHealthy = jobStatuses.filter((js) => js.severity !== "healthy");
  const exceptions = nonHealthy.filter(
    (js) => js.severity === "unknown" || isExceptionInWindow(js, js.latestRun as Run | undefined, start),
  );

  // When viewing the aggregate, a child scope going dark shows up as its
  // own exception row rather than a silent gap in the numbers.
  const syntheticOutageExceptions: JobStatus[] =
    isAggregate
      ? unreachableChildScopes.map(({ id, name }) => ({
          jobId: `__outage__${id}`,
          jobName: `${name} connector`,
          owner: name,
          scopeId: id,
          severity: "outage",
          headline: "Can't confirm status",
          detail: `We lost contact with ${name}'s data source ${formatRelative(snapshot.lastSyncedAt, now)}. Its jobs aren't included in the counts above until this reconnects.`,
          blocksDownstream: [],
          baseline: { failureRatePercent: 0, isTypicalToday: true },
          hasHistory: true,
        }))
      : [];

  const allExceptions = [...syntheticOutageExceptions, ...exceptions].sort(
    (a, b) => SEVERITY_RANK.indexOf(a.severity) - SEVERITY_RANK.indexOf(b.severity),
  );

  const healthyCount = jobStatuses.filter((js) => js.severity === "healthy").length;
  const totalJobs = jobStatuses.length;

  const hasAnyHistory = jobStatuses.some((js) => js.hasHistory);
  const emptyForWindow =
    exceptions.length === 0 &&
    syntheticOutageExceptions.length === 0 &&
    hasAnyHistory &&
    scopeJobs.every((j) => getExpectedRunTimes(j.schedule, start, now).length === 0);

  const allRunsInScope = scopeJobs.flatMap((j) => snapshot.runsByJobId.get(j.id) ?? []);
  const { trend, trendCopy } = computeTrend(scope.name, allRunsInScope, now);

  const kind = headlineKindFor([...jobStatuses, ...syntheticOutageExceptions], ownConnectorReachable, emptyForWindow);
  const lastSyncedRelative = formatRelative(snapshot.lastSyncedAt, now);
  const { headlineCopy, subCopy } = headlineCopyFor(
    kind,
    scope.name,
    allExceptions.length,
    totalJobs,
    healthyCount,
    trendCopy,
    lastSyncedRelative,
    allExceptions.filter((e) => e.severity === "critical"),
  );

  return {
    scopeId: scope.id,
    scopeName: scope.name,
    headline: kind,
    headlineCopy,
    subCopy,
    totalJobs,
    healthyCount,
    exceptions: allExceptions,
    connectorReachable: ownConnectorReachable,
    lastSyncedAt: ownConnectorReachable ? undefined : snapshot.lastSyncedAt,
    trend,
    trendCopy,
    window,
  };
}

export function getJobDetail(jobId: string, options: GlanceViewOptions = {}): JobDetailView | undefined {
  const now = options.now ?? new Date();
  const snapshot = fetchConnectorSnapshot(now, options.reachabilityOverrides ?? {});
  const job = snapshot.jobs.find((j) => j.id === jobId);
  if (!job) return undefined;

  const statusMap = classifyAllJobs(snapshot, now);
  const status = statusMap.get(jobId)!;
  const jobsById = new Map(snapshot.jobs.map((j) => [j.id, j]));
  const runs = (snapshot.runsByJobId.get(jobId) ?? [])
    .slice()
    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());

  const scope = SCOPES.find((s) => s.id === job.scopeId);

  return {
    jobId: job.id,
    jobName: job.name,
    owner: job.owner,
    scopeId: job.scopeId,
    scopeName: scope?.name ?? job.scopeId,
    severity: status.severity,
    headline: status.headline,
    detail: status.detail,
    cadenceLabel: CADENCE_LABEL[job.schedule.cadence],
    expectedDurationLabel: formatDurationMinutes(job.sla.expectedDurationMinutes),
    dependsOnNames: job.dependsOn.map((id) => jobsById.get(id)?.name ?? id),
    blocksDownstream: status.blocksDownstream,
    latestRun: status.latestRun,
    recentRuns: runs.slice(0, 10).map((r) => ({
      status: r.status,
      scheduledAt: r.scheduledAt,
      startedAt: r.startedAt,
      endedAt: r.endedAt,
      errorSummary: r.errorSummary,
    })),
    baseline: status.baseline,
  };
}
