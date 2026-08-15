"use client";

import { useMemo } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getJobDetail } from "@/model";
import { useTenantConfig } from "@/config/TenantConfigProvider";
import { SEVERITY_LABEL, SEVERITY_VISUAL } from "./visuals";

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

export function JobDetail({ jobId }: { jobId: string }) {
  const tenant = useTenantConfig();
  const job = useMemo(() => getJobDetail(jobId, { terms: tenant.terminology }), [jobId, tenant.terminology]);

  if (!job) notFound();

  const terms = tenant.terminology;
  const visual = SEVERITY_VISUAL[job.severity];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to glance
      </Link>

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
