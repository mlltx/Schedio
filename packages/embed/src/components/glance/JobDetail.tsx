"use client";

import { forwardRef, type CSSProperties, type ReactNode } from "react";
import { ArrowLeft, Waypoints } from "lucide-react";
import { getJobDetail, type ConnectorFn, type RunStatus, type Terminology } from "@/model";
import { useTenantConfig } from "@/config/TenantConfigProvider";
import { SEVERITY_LABEL, SEVERITY_VISUAL, type Visual } from "./visuals";
import { usePromise } from "./usePromise";
import { cx } from "./cx";
import { NavLink } from "./NavLink";
import { formatShortDateTime } from "./format";
import { DependencyGraphCanvas } from "../graph/DependencyGraphCanvas";
import type { JobNavigation } from "./navigation";

const RUN_STATUS_LABEL: Record<RunStatus, string> = {
  success: "Succeeded",
  failed: "Failed",
  running: "Running",
  retrying: "Retrying",
};

const RUN_STATUS_VISUAL: Record<RunStatus, Visual> = {
  success: SEVERITY_VISUAL.healthy,
  failed: SEVERITY_VISUAL.needs_attention,
  retrying: SEVERITY_VISUAL.recovering,
  running: SEVERITY_VISUAL.late,
};

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const defaultLoading = () => (
  <div className="animate-pulse rounded-2xl border border-zinc-200 bg-zinc-100 px-6 py-10 dark:border-zinc-800 dark:bg-zinc-900" />
);

const defaultNotFound = (terms: Terminology) => (
  <p className="text-sm text-zinc-500 dark:text-zinc-400">This {terms.job} could not be found.</p>
);

export interface JobDetailProps extends JobNavigation {
  jobId: string;
  /** Where the data comes from. Defaults to Schedio's built-in mock connector. */
  connector?: ConnectorFn;
  /** If provided, "Back to glance" renders as a real link to this href. */
  backHref?: string;
  /** Called when "Back to glance" is activated — use for client-side routing. */
  onBack?: () => void;
  /** Real href for "View full pipeline" below the dependency graph, when this job has one. */
  getPipelineHref?: (jobId: string) => string;
  /** Called when "View full pipeline" is activated — use for client-side routing. */
  onViewPipeline?: (jobId: string) => void;
  /** Replaces the default skeleton shown while the fetch is in flight. */
  renderLoading?: () => ReactNode;
  /** Replaces the default "This job could not be found" message. Still rendered below the back link. */
  renderNotFound?: () => ReactNode;
  /** Merged onto the root element — the standard escape hatch for one-off layout nudges. */
  className?: string;
  style?: CSSProperties;
}

function BackLink({ backHref, onBack }: Pick<JobDetailProps, "backHref" | "onBack">) {
  if (!backHref && !onBack) return null;
  return (
    <NavLink
      href={backHref}
      onActivate={onBack}
      className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Back to glance
    </NavLink>
  );
}

export const JobDetail = forwardRef<HTMLDivElement, JobDetailProps>(function JobDetail(
  {
    jobId,
    connector,
    backHref,
    onBack,
    getPipelineHref,
    onViewPipeline,
    getJobHref,
    onJobSelect,
    renderLoading = defaultLoading,
    renderNotFound,
    className,
    style,
  },
  ref,
) {
  const tenant = useTenantConfig();
  const job = usePromise(async () => {
    const result = await getJobDetail(jobId, { terms: tenant.terminology, connector });
    return result ?? null;
  }, [jobId, tenant.terminology, connector]);

  const rootClassName = cx("schedio-embed-root mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12", className);

  if (job === undefined) {
    return (
      <div ref={ref} style={style} className={rootClassName}>
        {renderLoading()}
      </div>
    );
  }

  if (job === null) {
    return (
      <div ref={ref} style={style} className={rootClassName}>
        <BackLink backHref={backHref} onBack={onBack} />
        {(renderNotFound ?? (() => defaultNotFound(tenant.terminology)))()}
      </div>
    );
  }

  const terms = tenant.terminology;
  const visual = SEVERITY_VISUAL[job.severity];

  return (
    <div ref={ref} style={style} className={rootClassName}>
      <BackLink backHref={backHref} onBack={onBack} />

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {job.scopeName}
            {job.owner !== job.scopeName ? ` · ${job.owner}` : ""}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
            {job.jobName}
          </h1>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${visual.bannerBg} ${visual.bannerText}`}
        >
          {SEVERITY_LABEL[job.severity]}
        </span>
      </div>

      <div className={`mt-5 rounded-xl border px-4 py-4 ${visual.bannerBg} ${visual.bannerBorder}`}>
        <p className={`font-medium ${visual.bannerText}`}>{job.headline}</p>
        <p className={`mt-1 text-sm ${visual.bannerText} opacity-80`}>{job.detail}</p>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <dt className="text-xs text-zinc-500 dark:text-zinc-400">{capitalize(terms.runs)}</dt>
          <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{job.cadenceLabel}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500 dark:text-zinc-400">Usually takes</dt>
          <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{job.expectedDurationLabel}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500 dark:text-zinc-400">Historical failure rate</dt>
          <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{job.baseline.failureRatePercent}%</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500 dark:text-zinc-400">Today</dt>
          <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {job.baseline.isTypicalToday ? "Typical" : "Unusual"}
          </dd>
        </div>
      </dl>

      {job.dependencyGraph.nodes.length > 1 && (
        <div className="mt-8">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
              Dependency graph
            </h2>
            {job.dependencyGraph.truncated && (getPipelineHref || onViewPipeline) && (
              <NavLink
                href={getPipelineHref?.(job.jobId)}
                onActivate={onViewPipeline ? () => onViewPipeline(job.jobId) : undefined}
                className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                <Waypoints className="h-3.5 w-3.5" aria-hidden />
                View full pipeline
              </NavLink>
            )}
          </div>
          <DependencyGraphCanvas
            graph={job.dependencyGraph}
            variant="compact"
            getJobHref={getJobHref}
            onJobSelect={onJobSelect}
          />
        </div>
      )}

      <div className="mt-8">
        <h2 className="mb-3 text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
          Recent {terms.runs}
        </h2>
        {job.recentRuns.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No {terms.runs} recorded yet.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {job.recentRuns.map((run, i) => (
              <div
                key={`${run.scheduledAt}-${i}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3.5 py-2.5 text-sm dark:border-zinc-800"
              >
                <span className="flex items-center gap-2.5 text-zinc-700 dark:text-zinc-300">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${RUN_STATUS_VISUAL[run.status].dot}`} />
                  {formatShortDateTime(run.scheduledAt)}
                </span>
                <span className="text-right text-zinc-500 dark:text-zinc-400">
                  {RUN_STATUS_LABEL[run.status]}
                  {run.errorSummary ? ` — ${run.errorSummary}` : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="mt-10 text-xs text-zinc-400 dark:text-zinc-600">
        Logs and configuration would live behind a &ldquo;technical details&rdquo; disclosure here in a full
        build — this stub covers what a non-engineer needs to answer &ldquo;why did this happen?&rdquo;
      </p>
    </div>
  );
});
