/**
 * Schedio's backend-agnostic model. Nothing in this file (or anywhere under
 * src/model/) may use scheduler-specific vocabulary (DAG, task instance,
 * operator, etc.) — a connector's job is to translate into these shapes,
 * not the other way around.
 */

// ---------------------------------------------------------------------------
// Raw model: what a connector reports. Internal to the model layer — the UI
// never sees these types directly, only the computed views below.
// ---------------------------------------------------------------------------

export type Cadence = "hourly" | "every_6_hours" | "daily" | "weekly" | "monthly";

export interface Schedule {
  cadence: Cadence;
  /** Hour of day (0-23) an occurrence is due. Ignored for hourly/every_6_hours. */
  hour?: number;
  minute?: number;
  /** 0 = Sunday ... 6 = Saturday. Only used for weekly cadence. */
  weekday?: number;
  /** 1-28. Only used for monthly cadence. */
  dayOfMonth?: number;
}

export interface Sla {
  expectedDurationMinutes: number;
  /** How long past the expected time/duration before we call it "late". */
  graceMinutes: number;
}

export interface Job {
  id: string;
  name: string;
  owner: string;
  scopeId: string;
  schedule: Schedule;
  sla: Sla;
  /** Upstream job ids this job waits on. */
  dependsOn: string[];
}

export type RunStatus = "success" | "failed" | "running" | "retrying";

export interface Run {
  id: string;
  jobId: string;
  scheduledAt: string;
  startedAt?: string;
  endedAt?: string;
  status: RunStatus;
  attempt: number;
  errorSummary?: string;
}

export interface Scope {
  id: string;
  name: string;
  /** "all" is the single synthetic roll-up-of-everything scope. */
  kind: "all" | "team";
}

// ---------------------------------------------------------------------------
// Computed model: the *only* shapes the UI is allowed to read. Everything
// here is derived by src/model/compute.ts from the raw data above, so the
// synthesis logic lives in exactly one place regardless of which connector
// produced the raw data.
// ---------------------------------------------------------------------------

export type Severity =
  | "healthy"
  | "recovering"
  | "late"
  | "missing"
  | "needs_attention"
  | "critical"
  | "unknown"
  /** A connector is unreachable — distinct from "unknown" (newly connected,
   * never had data): this means we *had* data and lost contact. Only ever
   * appears as a synthetic entry representing a whole scope, never on a
   * real job. */
  | "outage";

export interface LatestRunView {
  status: RunStatus;
  scheduledAt: string;
  startedAt?: string;
  endedAt?: string;
  errorSummary?: string;
}

export interface JobStatus {
  jobId: string;
  jobName: string;
  owner: string;
  scopeId: string;
  severity: Severity;
  /** Short, plain-language summary. This is what renders in the exception list. */
  headline: string;
  /** Slightly longer plain-language explanation, for the detail view. */
  detail: string;
  latestRun?: LatestRunView;
  /** Plain names of downstream jobs waiting on this one. */
  blocksDownstream: string[];
  baseline: {
    failureRatePercent: number;
    isTypicalToday: boolean;
  };
  hasHistory: boolean;
  /** True when this run happened outside the currently selected time window. */
  asOfLastCheck?: boolean;
}

export type HeadlineKind =
  | "healthy"
  | "needs_attention"
  | "critical"
  | "unreachable"
  | "no_data"
  | "empty";

export interface TrendPoint {
  date: string;
  failedCount: number;
  totalCount: number;
}

export interface ScopeStatus {
  scopeId: string;
  scopeName: string;
  headline: HeadlineKind;
  headlineCopy: string;
  subCopy: string;
  totalJobs: number;
  healthyCount: number;
  exceptions: JobStatus[];
  connectorReachable: boolean;
  lastSyncedAt?: string;
  trend: TrendPoint[];
  trendCopy: string;
  window: TimeWindow;
}

export type TimeWindow = "since_midnight" | "last_24h" | "last_7d";

export interface JobDetailView {
  jobId: string;
  jobName: string;
  owner: string;
  scopeId: string;
  scopeName: string;
  severity: Severity;
  headline: string;
  detail: string;
  cadenceLabel: string;
  expectedDurationLabel: string;
  dependsOnNames: string[];
  blocksDownstream: string[];
  latestRun?: LatestRunView;
  recentRuns: LatestRunView[];
  baseline: {
    failureRatePercent: number;
    isTypicalToday: boolean;
  };
}
