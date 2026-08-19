import { ChevronRight } from "lucide-react";
import type { JobStatus, Terminology } from "../../model";
import { SEVERITY_LABEL, SEVERITY_VISUAL } from "./visuals";
import { NavLink } from "./NavLink";
import type { JobNavigation } from "./navigation";

const rowClasses =
  "group flex w-full items-center gap-3.5 rounded-xl border border-zinc-200 bg-white px-4 py-3.5 text-left transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700 dark:hover:bg-zinc-900";

export function ExceptionRow({
  status,
  terms,
  onOutageClick,
  getJobHref,
  onJobSelect,
}: {
  status: JobStatus;
  terms: Terminology;
  onOutageClick?: (scopeId: string) => void;
} & JobNavigation) {
  const visual = SEVERITY_VISUAL[status.severity];
  const isOutage = status.severity === "outage";

  const content = (
    <>
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${visual.dot}`} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-medium text-zinc-900 dark:text-zinc-100">{status.jobName}</span>
          <span className="text-xs text-zinc-400 dark:text-zinc-500">{status.owner}</span>
          {status.baseline.isTypicalToday === false && (
            <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              unusual for this {terms.job}
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
      <NavLink onActivate={() => onOutageClick?.(status.scopeId)} className={rowClasses}>
        {content}
      </NavLink>
    );
  }

  return (
    <NavLink href={getJobHref?.(status.jobId)} onActivate={onJobSelect && (() => onJobSelect(status.jobId))} className={rowClasses}>
      {content}
    </NavLink>
  );
}
