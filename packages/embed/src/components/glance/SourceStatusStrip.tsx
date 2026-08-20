import type { SourceStatus } from "../../model";
import { SEVERITY_VISUAL } from "./visuals";

/**
 * "Is Airflow-staging itself up" is a different question from "is any job
 * in Airflow-staging healthy" — this answers it directly, at a glance,
 * instead of making a viewer infer a whole backend's reachability from job
 * counts. Only rendered when `sources` exists at all (i.e. the connector is
 * a `combineConnectors` result) — a single connector's reachability is
 * already covered by its scopes' own status.
 *
 * Deliberately terse in the common case (a dot plus the source's id) —
 * `statusCopy` is still there as a tooltip — but an unreachable source
 * spells it out inline rather than waiting for a hover, the same bias
 * toward surfacing exceptions everything else in this view has.
 */
export function SourceStatusStrip({ sources }: { sources: SourceStatus[] }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {sources.map((source) => {
        const visual = source.reachable ? SEVERITY_VISUAL.healthy : SEVERITY_VISUAL.outage;
        return (
          <span
            key={source.id}
            title={source.statusCopy}
            className="flex shrink-0 items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400"
          >
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${visual.dot}`} aria-hidden />
            {source.id}
            {!source.reachable && <span className={visual.text}>· {source.statusCopy}</span>}
          </span>
        );
      })}
    </div>
  );
}
