import type { JobStatus, Terminology } from "../../model";
import { ExceptionRow } from "./ExceptionRow";
import type { JobNavigation } from "./navigation";

export function ExceptionList({
  exceptions,
  heading,
  terms,
  onOutageClick,
  getJobHref,
  onJobSelect,
}: {
  exceptions: JobStatus[];
  heading: string;
  terms: Terminology;
  onOutageClick?: (scopeId: string) => void;
} & JobNavigation) {
  if (exceptions.length === 0) return null;

  return (
    <div className="mt-8">
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
        {heading} ({exceptions.length})
      </h2>
      <div className="flex flex-col gap-2">
        {exceptions.map((status) => (
          <ExceptionRow
            key={status.jobId}
            status={status}
            terms={terms}
            onOutageClick={onOutageClick}
            getJobHref={getJobHref}
            onJobSelect={onJobSelect}
          />
        ))}
      </div>
    </div>
  );
}
