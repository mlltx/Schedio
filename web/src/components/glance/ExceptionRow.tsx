import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { JobStatus } from "@/model";
import { SEVERITY_LABEL, SEVERITY_VISUAL } from "./visuals";

const rowClasses =
  "group flex w-full items-center gap-3.5 rounded-xl border border-zinc-200 bg-white px-4 py-3.5 text-left transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700 dark:hover:bg-zinc-900";

export function ExceptionRow({
  status,
  onOutageClick,
}: {
  status: JobStatus;
  onOutageClick?: (scopeId: string) => void;
}) {
  const visual = SEVERITY_VISUAL[status.severity];
  const isOutage = status.jobId.startsWith("__outage__");

  const content = (
    <>
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${visual.dot}`} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-medium text-zinc-900 dark:text-zinc-100">{status.jobName}</span>
          <span className="text-xs text-zinc-400 dark:text-zinc-500">{status.owner}</span>
          {status.baseline.isTypicalToday === false && (
            <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              unusual for this job
            </span>
          )}
        </span>
        <span className={`mt-0.5 block text-sm ${visual.text}`}>{status.headline}</span>
      </span>
      <span className="hidden shrink-0 text-xs font-medium text-zinc-400 sm:block">
        {SEVERITY_LABEL[status.severity]}
      </span>
      <ChevronRight
        className="h-4 w-4 shrink-0 text-zinc-300 transition-transform group-hover:translate-x-0.5 dark:text-zinc-600"
        aria-hidden
      />
    </>
  );

  if (isOutage) {
    return (
      <button type="button" onClick={() => onOutageClick?.(status.scopeId)} className={rowClasses}>
        {content}
      </button>
    );
  }

  return (
    <Link href={`/jobs/${status.jobId}`} className={rowClasses}>
      {content}
    </Link>
  );
}
