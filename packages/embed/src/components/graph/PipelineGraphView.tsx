"use client";

import { forwardRef, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowLeft, Search, Waypoints } from "lucide-react";
import { getDependencyGraph, type ConnectorFn, type DependencyGraph, type Terminology } from "@/model";
import { useTenantConfig } from "@/config/TenantConfigProvider";
import { usePromise } from "../glance/usePromise";
import { cx } from "../glance/cx";
import { NavLink } from "../glance/NavLink";
import type { JobNavigation } from "../glance/navigation";
import { DependencyGraphCanvas } from "./DependencyGraphCanvas";

/**
 * The threshold above which a pipeline is "large enough" that dumping every
 * node on screen at once is noise rather than signal — past this, the view
 * defaults to focusing the camera on whatever's actually broken (plus one
 * hop of context) instead of fitting the whole graph. See the design
 * proposal: a big pipeline with one broken branch shouldn't make you hunt
 * for it among dozens of healthy nodes.
 */
const AUTO_FOCUS_NODE_THRESHOLD = 15;

const NON_HEALTHY = new Set(["critical", "needs_attention", "missing", "late", "recovering"]);

const defaultLoading = () => (
  <div className="h-full w-full animate-pulse rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900" />
);

const defaultNotFound = (terms: Terminology) => (
  <p className="text-sm text-zinc-500 dark:text-zinc-400">This {terms.job}&rsquo;s pipeline could not be found.</p>
);

export interface PipelineGraphViewProps extends JobNavigation {
  jobId: string;
  /** Where the data comes from. Defaults to Schedio's built-in mock connector. */
  connector?: ConnectorFn;
  /** If provided, "Back to job" renders as a real link to this href. */
  backHref?: string;
  /** Called when "Back to job" is activated — use for client-side routing. */
  onBack?: () => void;
  /** Replaces the default skeleton shown while the fetch is in flight. */
  renderLoading?: () => ReactNode;
  /** Replaces the default "pipeline could not be found" message. */
  renderNotFound?: () => ReactNode;
  /** Merged onto the root element — the standard escape hatch for one-off layout nudges. */
  className?: string;
  style?: CSSProperties;
}

function contextIdsAround(graph: DependencyGraph, centerIds: Set<string>): Set<string> {
  const result = new Set(centerIds);
  for (const edge of graph.edges) {
    if (centerIds.has(edge.fromJobId)) result.add(edge.toJobId);
    if (centerIds.has(edge.toJobId)) result.add(edge.fromJobId);
  }
  return result;
}

export const PipelineGraphView = forwardRef<HTMLDivElement, PipelineGraphViewProps>(function PipelineGraphView(
  { jobId, connector, backHref, onBack, renderLoading = defaultLoading, renderNotFound, className, style, getJobHref, onJobSelect },
  ref,
) {
  const tenant = useTenantConfig();
  const terms = tenant.terminology;

  const graph = usePromise(async () => {
    const result = await getDependencyGraph(jobId, { terms, connector });
    return result ?? null;
  }, [jobId, terms, connector]);

  const [showAll, setShowAll] = useState(false);
  const [hideHealthy, setHideHealthy] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchFocusId, setSearchFocusId] = useState<string | null>(null);

  const problemIds = useMemo(() => {
    if (!graph) return new Set<string>();
    return new Set(graph.nodes.filter((n) => NON_HEALTHY.has(n.severity)).map((n) => n.jobId));
  }, [graph]);

  const isLarge = (graph?.nodes.length ?? 0) > AUTO_FOCUS_NODE_THRESHOLD;
  const contextIds = useMemo(
    () => (graph ? contextIdsAround(graph, problemIds) : new Set<string>()),
    [graph, problemIds],
  );

  const dimmedIds = useMemo(() => {
    if (!graph || !hideHealthy || problemIds.size === 0) return new Set<string>();
    return new Set(graph.nodes.map((n) => n.jobId).filter((id) => !contextIds.has(id)));
  }, [graph, hideHealthy, problemIds, contextIds]);

  const focusIds = searchFocusId
    ? new Set([searchFocusId])
    : !showAll && isLarge && problemIds.size > 0
      ? contextIds
      : undefined;

  const matches = useMemo(() => {
    if (!graph || !searchTerm.trim()) return [];
    const q = searchTerm.trim().toLowerCase();
    return graph.nodes.filter((n) => n.jobName.toLowerCase().includes(q)).slice(0, 8);
  }, [graph, searchTerm]);

  const rootClassName = cx("schedio-embed-root flex h-full w-full flex-col px-4 py-6 sm:px-6 sm:py-8", className);

  if (graph === undefined) {
    return (
      <div ref={ref} style={style} className={rootClassName}>
        {renderLoading()}
      </div>
    );
  }

  if (graph === null) {
    return (
      <div ref={ref} style={style} className={rootClassName}>
        <BackLink backHref={backHref} onBack={onBack} />
        {(renderNotFound ?? (() => defaultNotFound(terms)))()}
      </div>
    );
  }

  const hiddenCount = dimmedIds.size;

  return (
    <div ref={ref} style={style} className={rootClassName}>
      <BackLink backHref={backHref} onBack={onBack} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Waypoints className="h-5 w-5 text-zinc-400 dark:text-zinc-500" aria-hidden />
          <h1 className="text-lg font-semibold text-zinc-900 sm:text-xl dark:text-zinc-50">
            Full pipeline
            <span className="ml-2 font-normal text-zinc-400 dark:text-zinc-500">
              {graph.nodes.length} {graph.nodes.length === 1 ? terms.job : terms.jobs}
            </span>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" aria-hidden />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setSearchFocusId(null);
              }}
              placeholder={`Find a ${terms.job}...`}
              className="w-44 rounded-lg border border-zinc-200 bg-white py-1.5 pr-2.5 pl-8 text-xs text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none sm:w-56 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            {matches.length > 0 && (
              <div className="absolute top-full z-10 mt-1 w-full overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                {matches.map((m) => (
                  <button
                    key={m.jobId}
                    onClick={() => {
                      setSearchFocusId(m.jobId);
                      setSearchTerm(m.jobName);
                    }}
                    className="block w-full truncate px-3 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    {m.jobName}
                  </button>
                ))}
              </div>
            )}
          </div>

          {problemIds.size > 0 && (
            <button
              onClick={() => setHideHealthy((v) => !v)}
              className={cx(
                "rounded-lg border px-2.5 py-1.5 text-xs font-medium whitespace-nowrap",
                hideHealthy
                  ? "border-zinc-800 bg-zinc-800 text-white dark:border-zinc-200 dark:bg-zinc-200 dark:text-zinc-900"
                  : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900",
              )}
            >
              {hideHealthy ? `Focused on issues${hiddenCount > 0 ? ` (${hiddenCount} hidden)` : ""}` : "Focus on issues"}
            </button>
          )}

          {isLarge && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              {showAll ? "Fit to issues" : "Fit to full pipeline"}
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <DependencyGraphCanvas
          graph={graph}
          variant="full"
          dimmedIds={dimmedIds}
          focusIds={focusIds}
          getJobHref={getJobHref}
          onJobSelect={onJobSelect}
        />
      </div>
    </div>
  );
});

function BackLink({ backHref, onBack }: Pick<PipelineGraphViewProps, "backHref" | "onBack">) {
  if (!backHref && !onBack) return null;
  return (
    <NavLink
      href={backHref}
      onActivate={onBack}
      className="mb-4 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Back to job
    </NavLink>
  );
}
