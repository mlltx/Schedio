"use client";

import { forwardRef, type CSSProperties, type ReactNode } from "react";
import { ExternalLink, Waypoints } from "lucide-react";
import { getJobDetail, mockConnector, resolvePollIntervalMs, type ConnectorFn, type RunStatus, type Terminology } from "@/model";
import { useTenantConfig } from "@/config/TenantConfigProvider";
import { SEVERITY_LABEL, SEVERITY_VISUAL, type Visual } from "./visuals";
import { usePromise } from "./usePromise";
import { cx } from "./cx";
import { NavLink } from "./NavLink";
import { BackLink } from "./BackLink";
import { formatShortDateTime } from "./format";
import { DependencyGraphCanvas } from "../graph/DependencyGraphCanvas";
import type { JobNavigation } from "./navigation";
import { Heading, type HeadingLevel } from "./Heading";
import { useResolvedColorScheme, colorSchemeClassName, type ColorScheme } from "./colorScheme";

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
  /**
   * Heading level for the job name — the most prominent text in this
   * view. Defaults to `1`; set it to match wherever this sits in the host
   * page's own document outline (e.g. `2` if the host's page already has
   * its own `<h1>`).
   */
  headingLevel?: HeadingLevel;
  /**
   * `"system"` (the default) follows the OS/browser preference. Set to
   * `"light"`/`"dark"` to defer to a host's own theme toggle instead —
   * see `components/glance/colorScheme.ts`.
   */
  colorScheme?: ColorScheme;
  /**
   * Caps the root element's width, same value shape as CSS `max-width`
   * (`"56rem"`, `"100%"`, `640`, ...). Defaults to `"42rem"`. Applied as an
   * inline style rather than a Tailwind class specifically so it's
   * guaranteed to win — see `GlanceViewProps.maxWidth` for why `className`
   * can't reliably do this.
   */
  maxWidth?: string | number;
  /** Merged onto the root element — the standard escape hatch for one-off layout nudges; not for structural overrides like width (see `maxWidth`). */
  className?: string;
  style?: CSSProperties;
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
    headingLevel,
    colorScheme,
    maxWidth = "42rem",
    className,
    style,
  },
  ref,
) {
  const tenant = useTenantConfig();
  const resolvedColorScheme = useResolvedColorScheme(colorScheme);
  const job = usePromise(
    async () => {
      const result = await getJobDetail(jobId, { terms: tenant.terminology, connector });
      return result ?? null;
    },
    [jobId, tenant.terminology, connector],
    resolvePollIntervalMs(connector ?? mockConnector),
  );

  const rootClassName = cx(
    "schedio-embed-root mx-auto w-full px-4 py-8 sm:px-6 sm:py-12",
    colorSchemeClassName(resolvedColorScheme),
    className,
  );
  const rootStyle: CSSProperties = { maxWidth, ...style };

  if (job === undefined) {
    return (
      <div ref={ref} style={rootStyle} className={rootClassName}>
        {renderLoading()}
      </div>
    );
  }

  if (job === null) {
    return (
      <div ref={ref} style={rootStyle} className={rootClassName}>
        <BackLink backHref={backHref} onBack={onBack} label={tenant.copy.backToGlance} className="mb-6" />
        {(renderNotFound ?? (() => defaultNotFound(tenant.terminology)))()}
      </div>
    );
  }

  const terms = tenant.terminology;
  const visual = SEVERITY_VISUAL[job.severity];

  return (
    <div ref={ref} style={rootStyle} className={rootClassName}>
      <BackLink backHref={backHref} onBack={onBack} label={tenant.copy.backToGlance} className="mb-6" />

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {job.scopeName}
            {job.owner !== job.scopeName ? ` · ${job.owner}` : ""}
          </p>
          <Heading level={headingLevel} className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
            {job.jobName}
          </Heading>
          {job.sourceUrl && (
            <a
              href={job.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              <ExternalLink className="h-3 w-3" aria-hidden />
              Open in {job.sourceLabel ?? tenant.copy.genericSourceLabel}
            </a>
          )}
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
          <dt className="text-xs text-zinc-500 dark:text-zinc-400">{tenant.copy.usuallyTakesLabel}</dt>
          <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{job.expectedDurationLabel}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500 dark:text-zinc-400">{tenant.copy.historicalFailureRateLabel}</dt>
          <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{job.baseline.failureRatePercent}%</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500 dark:text-zinc-400">{tenant.copy.todayLabel}</dt>
          <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {job.baseline.isTypicalToday ? tenant.copy.typicalLabel : tenant.copy.unusualLabel}
          </dd>
        </div>
      </dl>

      {job.dependencyGraph.nodes.length > 1 && (
        <div className="mt-8">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
              {tenant.copy.dependencyGraphHeading}
            </h2>
            {job.dependencyGraph.truncated && (getPipelineHref || onViewPipeline) && (
              <NavLink
                href={getPipelineHref?.(job.jobId)}
                onActivate={onViewPipeline ? () => onViewPipeline(job.jobId) : undefined}
                className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                <Waypoints className="h-3.5 w-3.5" aria-hidden />
                {tenant.copy.viewFullPipeline}
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
    </div>
  );
});
