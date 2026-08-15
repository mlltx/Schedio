import type { JobStatus } from "@/model";
import { ExceptionRow } from "./ExceptionRow";

export function ExceptionList({
  exceptions,
  heading,
  onOutageClick,
}: {
  exceptions: JobStatus[];
  heading: string;
  onOutageClick?: (scopeId: string) => void;
}) {
  if (exceptions.length === 0) return null;

  return (
    <div className="mt-8">
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
        {heading} ({exceptions.length})
      </h2>
      <div className="flex flex-col gap-2">
        {exceptions.map((status) => (
          <ExceptionRow key={status.jobId} status={status} onOutageClick={onOutageClick} />
        ))}
      </div>
    </div>
  );
}
