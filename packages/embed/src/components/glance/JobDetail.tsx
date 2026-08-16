"use client";

import { ArrowLeft } from "lucide-react";
import { getJobDetail, type ConnectorFn } from "@/model";
import { useTenantConfig } from "@/config/TenantConfigProvider";
import { SEVERITY_LABEL, SEVERITY_VISUAL } from "./visuals";
import { usePromise } from "./usePromise";

function formatClock(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const RUN_STATUS_LABEL: Record<string, string> = {
  success: "Succeeded",
  failed: "Failed",
  running: "Running",
  retrying: "Retrying",
};

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export interface JobDetailProps {
  jobId: string;
  /** Where the data comes from. Defaults to Schedio's built-in mock connector. */
  connector?: ConnectorFn;
  /** If provided, "Back to glance" renders as a real link to this href. */
  backHref?: string;
  /** Called when "Back to glance" is activated — use for client-side routing. */
  onBack?: () => void;
}

function BackLink({ backHref, onBack }: Pick<JobDetailProps, "backHref" | "onBack">) {
  const className =
    "mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200";
  const content = (
    <>
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Back to glance
    </>
  );
  if (backHref) {
    return (
      <a
        href={backHref}
        onClick={onBack ? (e) => (e.preventDefault(), onBack()) : undefined}
        className={className}
      >
        {content}
      </a>
    );
  }
  if (onBack) {
    return (
      <button type="button" onClick={onBack} className={className}>
        {content}
      </button>
    );
  }
  return null;
}

export function JobDetail({ jobId, connector, backHref, onBack }: JobDetailProps) {
  const tenant = useTenantConfig();
  const job = usePromise(async () => {
    const result = await getJobDetail(jobId, { terms: tenant.terminology, connector });
    return result ?? null;
  }, [jobId, tenant.terminology, connector]);

  if (job === undefined) {
    return (
      <div className="schedio-embed-root mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="animate-pulse rounded-2xl border border-zinc-200 bg-zinc-100 px-6 py-10 dark:border-zinc-800 dark:bg-zinc-900" />
      </div>
    );
  }

  if (job === null) {
    return (
      <div className="schedio-embed-root mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        <BackLink backHref={backHref} onBack={onBack} />
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          This {tenant.terminology.job} could not be found.
        </p>
      </div>
    );
  }

  const terms = tenant.terminology;
  const visual = SEVERITY_VISUAL[job.severity];

  return (
    <div className="schedio-embed-root mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
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

      {(job.dependsOnNames.length > 0 || job.blocksDownstream.length > 0) && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {job.dependsOnNames.length > 0 && (
            <div>
              <h2 className="mb-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                Waits on
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {job.dependsOnNames.map((name) => (
                  <span
                    key={name}
                    className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}
          {job.blocksDownstream.length > 0 && (
            <div>
              <h2 className="mb-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                Other {terms.jobs} wait on this
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {job.blocksDownstream.map((name) => (
                  <span
                    key={name}
                    className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}
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
            {job.recentRuns.map((run, i) => {
              const runVisual =
                run.status === "success"
                  ? SEVERITY_VISUAL.healthy
                  : run.status === "failed"
                    ? SEVERITY_VISUAL.needs_attention
                    : run.status === "retrying"
                      ? SEVERITY_VISUAL.recovering
                      : SEVERITY_VISUAL.late;
              return (
                <div
                  key={`${run.scheduledAt}-${i}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3.5 py-2.5 text-sm dark:border-zinc-800"
                >
                  <span className="flex items-center gap-2.5 text-zinc-700 dark:text-zinc-300">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${runVisual.dot}`} />
                    {formatClock(run.scheduledAt)}
                  </span>
                  <span className="text-right text-zinc-500 dark:text-zinc-400">
                    {RUN_STATUS_LABEL[run.status] ?? run.status}
                    {run.errorSummary ? ` — ${run.errorSummary}` : ""}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="mt-10 text-xs text-zinc-400 dark:text-zinc-600">
        Logs and configuration would live behind a &ldquo;technical details&rdquo; disclosure here in a full
        build — this stub covers what a non-engineer needs to answer &ldquo;why did this happen?&rdquo;
      </p>
    </div>
  );
}
