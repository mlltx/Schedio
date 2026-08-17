import type {
  DependencyGraph,
  GraphEdge,
  GraphNode,
  Job,
  JobDetailView,
  JobStatus,
  Run,
  Scope,
  ScopeStatus,
  Terminology,
  TimeWindow,
} from "./types";
import { DEFAULT_TERMINOLOGY } from "./types";
import { getExpectedRunTimes, mockConnector, type ConnectorFn, type ConnectorSnapshot } from "./connector";
import { buildDependentIdsMap } from "./graph-utils";
import {
  CADENCE_LABEL,
  SEVERITY_RANK,
  classifyJob,
  computeTrend,
  formatDurationMinutes,
  formatRelative,
  headlineCopyFor,
  headlineKindFor,
  isBlockingSeverity,
  isExceptionInWindow,
  windowStart,
} from "./compute";

/**
 * This module is the model layer's public API. Nothing outside src/model/
 * may import from ./types, ./connector, or ./compute directly — only from
 * here. That boundary is what makes "the UI never talks to a scheduler
 * directly" true rather than aspirational: swapping the mock connector for
 * a real one only ever means passing a different `connector` option — no
 * component or compute.ts code needs to change.
 */

export type {
  DependencyGraph,
  GraphEdge,
  GraphNode,
  HeadlineKind,
  JobDetailView,
  JobStatus,
  Scope,
  ScopeStatus,
  Severity,
  Terminology,
  TimeWindow,
  TrendPoint,
} from "./types";
export { DEFAULT_TERMINOLOGY } from "./types";
// The one place that decides "does this severity need a second look" — see
// PipelineGraphView's issue-focus filter, which reads this instead of
// hand-copying its own severity allow-list.
export { isNonHealthySeverity } from "./compute";

// Raw model shapes + the connector seam itself. Components never see these —
// only someone implementing a real connector needs them.
export type { Job, Run, RunStatus, Schedule, Sla, Cadence } from "./types";
export type { ConnectorFn, ConnectorSnapshot, ConnectorSourceStatus } from "./connector";
export { mockConnector, combineConnectors, withScopeAccess, DEFAULT_POLL_INTERVAL_MS, resolvePollIntervalMs } from "./connector";

/**
 * A connector's own scopes — async because they're connector-reported now,
 * not a static list. `getAllScopeStatuses` already returns this alongside
 * every scope's rolled-up status for `GlanceView`'s own use; reach for this
 * directly only if you want the scope list without also paying for a full
 * rollup of every scope's jobs.
 */
export async function getScopes(options: GlanceViewOptions = {}): Promise<Scope[]> {
  const { snapshot } = await prepareData(options);
  return snapshot.scopes;
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

function classifyAllJobs(snapshot: ConnectorSnapshot, now: Date, terms: Terminology): Map<string, JobStatus> {
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
        terms,
      }),
    );
  }

  const jobsById = new Map(snapshot.jobs.map((j) => [j.id, j]));
  const final = new Map<string, JobStatus>();
  for (const job of snapshot.jobs) {
    const runs = snapshot.runsByJobId.get(job.id) ?? [];
    const failedUpstreamNames = job.dependsOn
      .map((depId) => withoutUpstream.get(depId))
      .filter((s): s is JobStatus => !!s && isBlockingSeverity(s.severity))
      .map((s) => jobsById.get(s.jobId)!.name);

    final.set(
      job.id,
      classifyJob({
        job,
        runs,
        now,
        dependentNames: dependentsMap.get(job.id) ?? [],
        failedUpstreamNames,
        terms,
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
  /** The tenant's vocabulary for "job"/"run"/etc. Defaults to Schedio's own. */
  terms?: Terminology;
  /** Where the raw data comes from. Defaults to the built-in mock connector. */
  connector?: ConnectorFn;
}

interface PreparedData {
  now: Date;
  terms: Terminology;
  snapshot: ConnectorSnapshot;
  statusMap: Map<string, JobStatus>;
}

/**
 * Every snapshot needs exactly one aggregate ("all") scope — it's what
 * `getGlanceView("all", ...)` and the switcher's default view resolve
 * against. Rather than trust every connector author to remember to emit
 * one (easy to miss, and the failure mode is quiet: "All" would silently
 * fall back to whichever scope happens to be first), guarantee it here,
 * once, for every snapshot regardless of which connector — or how many,
 * via `combineConnectors` — produced it.
 */
function withAggregateScope(snapshot: ConnectorSnapshot): ConnectorSnapshot {
  if (snapshot.scopes.some((s) => s.kind === "all")) return snapshot;
  return { ...snapshot, scopes: [{ id: "all", name: "All", kind: "all" }, ...snapshot.scopes] };
}

/**
 * Fetches the connector snapshot and classifies every job exactly once.
 * Neither step depends on which scope or time window is being viewed, so
 * this is shared across every scope's rollup rather than repeated per
 * scope — see `getAllScopeStatuses`, which is what makes the glance
 * view's "compute every scope's status dot at once" usage cheap instead
 * of re-fetching and re-classifying the whole dataset once per scope.
 */
async function prepareData(options: GlanceViewOptions): Promise<PreparedData> {
  const now = options.now ?? new Date();
  const terms = options.terms ?? DEFAULT_TERMINOLOGY;
  const connector = options.connector ?? mockConnector;
  const snapshot = withAggregateScope(await connector(now, options.reachabilityOverrides ?? {}));
  const statusMap = classifyAllJobs(snapshot, now, terms);
  return { now, terms, snapshot, statusMap };
}

function buildScopeStatus(scope: Scope, window: TimeWindow, { now, terms, snapshot, statusMap }: PreparedData): ScopeStatus {
  const isAggregate = scope.kind === "all";
  const scopeJobs = isAggregate
    ? snapshot.jobs.filter((j) => j.scopeId !== scope.id)
    : snapshot.jobs.filter((j) => j.scopeId === scope.id);

  const childScopeIds = [...new Set(scopeJobs.map((j) => j.scopeId))];
  const unreachableChildScopes = childScopeIds
    .filter((id) => !snapshot.reachableScopeIds.has(id))
    .map((id) => ({ id, name: snapshot.scopes.find((s) => s.id === id)?.name ?? id }));
  // "All" is an aggregate of several connectors, not a connector itself —
  // one child scope going dark is a partial-outage exception (handled
  // below via a synthetic row), not grounds for the whole aggregate to
  // read as "can't confirm anything". That banner is reserved for viewing
  // an unreachable scope directly.
  const ownConnectorReachable = isAggregate ? true : snapshot.reachableScopeIds.has(scope.id);

  const jobStatuses = scopeJobs.map((j) => statusMap.get(j.id)!).filter(Boolean);
  const start = windowStart(window, now);

  const nonHealthy = jobStatuses.filter((js) => js.severity !== "healthy");
  const exceptions = nonHealthy.filter(
    (js) => js.severity === "unknown" || isExceptionInWindow(js, js.latestRun as Run | undefined, start),
  );

  // When viewing the aggregate, a child scope going dark shows up as its
  // own exception row rather than a silent gap in the numbers.
  const syntheticOutageExceptions: JobStatus[] = isAggregate
    ? unreachableChildScopes.map(({ id, name }) => ({
        jobId: `__outage__${id}`,
        jobName: `${name} connector`,
        owner: name,
        scopeId: id,
        severity: "outage",
        headline: "Can't confirm status",
        detail: `We lost contact with ${name}'s data source ${formatRelative(snapshot.lastSyncedAt, now)}. Its ${terms.jobs} aren't included in the counts above until this reconnects.`,
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
    terms,
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

export async function getGlanceView(scopeId: string, window: TimeWindow, options: GlanceViewOptions = {}): Promise<ScopeStatus> {
  const prepared = await prepareData(options);
  const scope = prepared.snapshot.scopes.find((s) => s.id === scopeId) ?? prepared.snapshot.scopes[0];
  return buildScopeStatus(scope, window, prepared);
}

export interface AllScopeStatuses {
  /** Every scope this connector (or combination of connectors) reported, in the order it reported them. */
  scopes: Scope[];
  statuses: Record<string, ScopeStatus>;
}

/**
 * Every scope's status in one fetch — for a switcher that needs to show a
 * status dot per scope, this is the difference between fetching and
 * classifying the whole dataset once vs. once per scope. Also returns the
 * scope list itself: scopes are connector-reported now, not a static
 * import, so a caller needing "which scopes exist" (e.g. to render
 * switcher tabs) gets it from the same fetch instead of a second one.
 */
export async function getAllScopeStatuses(window: TimeWindow, options: GlanceViewOptions = {}): Promise<AllScopeStatuses> {
  const prepared = await prepareData(options);
  const { scopes } = prepared.snapshot;
  return {
    scopes,
    statuses: Object.fromEntries(scopes.map((scope) => [scope.id, buildScopeStatus(scope, window, prepared)])),
  };
}

export async function getJobDetail(
  jobId: string,
  options: GlanceViewOptions = {},
): Promise<JobDetailView | undefined> {
  const { snapshot, statusMap } = await prepareData(options);
  const job = snapshot.jobs.find((j) => j.id === jobId);
  if (!job) return undefined;

  const status = statusMap.get(jobId)!;
  const jobsById = new Map(snapshot.jobs.map((j) => [j.id, j]));
  const runs = (snapshot.runsByJobId.get(jobId) ?? [])
    .slice()
    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());

  const scope = snapshot.scopes.find((s) => s.id === job.scopeId);

  return {
    ...status,
    scopeName: scope?.name ?? job.scopeId,
    cadenceLabel: CADENCE_LABEL[job.schedule.cadence],
    expectedDurationLabel: formatDurationMinutes(job.sla.expectedDurationMinutes),
    dependsOnNames: job.dependsOn.map((id) => jobsById.get(id)?.name ?? id),
    dependencyGraph: buildDependencyGraph(jobId, 1, snapshot, statusMap),
    sourceUrl: job.sourceUrl,
    sourceLabel: job.sourceLabel,
    recentRuns: runs.slice(0, 10).map((r) => ({
      status: r.status,
      scheduledAt: r.scheduledAt,
      startedAt: r.startedAt,
      endedAt: r.endedAt,
      errorSummary: r.errorSummary,
    })),
  };
}

export interface DependencyGraphOptions extends GlanceViewOptions {
  /**
   * How many hops to walk from `jobId` in either direction. Omit (or
   * Infinity) for the whole connected pipeline; 1 for just the job's
   * immediate upstream/downstream neighbors — the compact view embedded on
   * the job detail page.
   */
  depth?: number;
}

/**
 * Walks `dependsOn` in both directions from `jobId` up to `depth` hops.
 * Shared by `getDependencyGraph` (any depth, its own fetch) and
 * `getJobDetail` (depth 1, reusing the fetch it already did) so the job
 * detail page's inline neighborhood never triggers a second connector
 * round-trip just to draw a few nodes it already has the data for.
 */
function buildDependencyGraph(
  jobId: string,
  depth: number,
  snapshot: ConnectorSnapshot,
  statusMap: Map<string, JobStatus>,
): DependencyGraph {
  const jobsById = new Map(snapshot.jobs.map((j) => [j.id, j]));
  const dependentIdsOf = buildDependentIdsMap(snapshot.jobs);

  const neighborsOf = (id: string) => [...(jobsById.get(id)?.dependsOn ?? []), ...(dependentIdsOf.get(id) ?? [])];

  const visited = new Set<string>([jobId]);
  let frontier = [jobId];
  for (let hop = 0; hop < depth && frontier.length > 0; hop++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const neighborId of neighborsOf(id)) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          next.push(neighborId);
        }
      }
    }
    frontier = next;
  }
  // The BFS hit the depth cap while the last frontier still had unvisited
  // neighbors to expand — there's more graph beyond what's included here.
  const truncated = frontier.some((id) => neighborsOf(id).some((n) => !visited.has(n)));

  const nodes: GraphNode[] = [...visited].map((id) => {
    const status = statusMap.get(id)!;
    return { jobId: id, jobName: status.jobName, severity: status.severity, headline: status.headline };
  });

  const edges: GraphEdge[] = [];
  for (const id of visited) {
    for (const depId of jobsById.get(id)?.dependsOn ?? []) {
      if (!visited.has(depId)) continue;
      const upstreamStatus = statusMap.get(depId)!;
      edges.push({
        fromJobId: depId,
        toJobId: id,
        isProblem: isBlockingSeverity(upstreamStatus.severity),
      });
    }
  }

  return { focalJobId: jobId, nodes, edges, truncated };
}

/**
 * A job's dependency graph — its immediate neighborhood, or its whole
 * connected pipeline, depending on `depth`. Every node's severity/headline
 * comes straight from the same `statusMap` the rest of the model uses, so
 * the graph view never re-derives status the way a component isn't allowed
 * to.
 */
export async function getDependencyGraph(
  jobId: string,
  options: DependencyGraphOptions = {},
): Promise<DependencyGraph | undefined> {
  const { snapshot, statusMap } = await prepareData(options);
  if (!statusMap.has(jobId)) return undefined;
  return buildDependencyGraph(jobId, options.depth ?? Infinity, snapshot, statusMap);
}
