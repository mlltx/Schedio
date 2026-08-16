"use client";

import { useEffect, useMemo } from "react";
import { Background, Controls, ReactFlow, ReactFlowProvider, useReactFlow, type NodeTypes } from "@xyflow/react";
// React Flow's base styles are pulled in via src/styles.css -> dist/style.css
// (already scoped under .schedio-embed-root by build-css.mjs) — importing
// them again here would leak an unscoped copy straight onto the host page.
import type { DependencyGraph } from "@/model";
import { GraphJobNode } from "./GraphJobNode";
import { applyGraphOverlay, computeGraphLayout } from "./layout";
import type { JobNavigation } from "../glance/navigation";

const nodeTypes: NodeTypes = { job: GraphJobNode };

export interface DependencyGraphCanvasProps extends JobNavigation {
  graph: DependencyGraph;
  /** "compact" is a small, non-interactive preview (the job detail page's inline neighborhood); "full" is pannable/zoomable with controls. */
  variant: "compact" | "full";
  /** Node ids to visually fade — used by the "focus on issues" filter in the full view. */
  dimmedIds?: Set<string>;
  /** Node ids to fit the initial viewport to. Defaults to every node. */
  focusIds?: Set<string>;
  height?: number | string;
}

function CanvasInner({
  graph,
  variant,
  dimmedIds,
  focusIds,
  getJobHref,
  onJobSelect,
}: DependencyGraphCanvasProps) {
  // Dagre positioning only depends on the graph's shape — memoized on
  // `graph` alone so a "focus on issues" toggle or a host re-render with a
  // fresh inline onJobSelect closure doesn't re-run layout on ~60 nodes for
  // what's really just a dimming/click-handler change (see layout.ts).
  const baseLayout = useMemo(() => computeGraphLayout(graph), [graph]);
  const { nodes, edges } = useMemo(
    () => applyGraphOverlay(baseLayout, { dimmedIds, getJobHref, onJobSelect }),
    [baseLayout, dimmedIds, getJobHref, onJobSelect],
  );

  const reactFlow = useReactFlow();
  // Re-fit whenever the graph identity or the focus set changes (e.g. the
  // "focus on issues" toggle) rather than only on first mount.
  const focusKey = focusIds ? [...focusIds].sort().join(",") : "";
  useEffect(() => {
    const targetIds = focusIds && focusIds.size > 0 ? [...focusIds] : nodes.map((n) => n.id);
    const raf = requestAnimationFrame(() => {
      reactFlow.fitView({ nodes: targetIds.map((id) => ({ id })), padding: 0.25, duration: 250, maxZoom: 1 });
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-fit on graph/focus identity, not node array reference
  }, [graph, focusKey]);

  const isCompact = variant === "compact";

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={!isCompact}
      panOnDrag={!isCompact}
      zoomOnScroll={!isCompact}
      zoomOnPinch={!isCompact}
      zoomOnDoubleClick={!isCompact}
      preventScrolling={!isCompact}
      minZoom={0.1}
      maxZoom={1.5}
    >
      <Background gap={16} size={1} className="!bg-zinc-50 dark:!bg-zinc-950" color="var(--schedio-graph-dot, #e4e4e7)" />
      {!isCompact && <Controls showInteractive={false} />}
    </ReactFlow>
  );
}

export function DependencyGraphCanvas(props: DependencyGraphCanvasProps) {
  return (
    <div
      style={{ height: props.height ?? (props.variant === "compact" ? 240 : "100%") }}
      className="w-full overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800"
    >
      <ReactFlowProvider>
        <CanvasInner {...props} />
      </ReactFlowProvider>
    </div>
  );
}
