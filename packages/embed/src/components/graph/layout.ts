import dagre from "@dagrejs/dagre";
import { MarkerType, type Edge, type Node } from "@xyflow/react";
import type { DependencyGraph, Severity } from "../../model";

/**
 * Real dependency chains can be a handful of hops (most scopes) or dozens
 * of nodes wide across six layers (a large pipeline) — hand-computed
 * columns, as sketched in the original design mockup, only holds up for
 * the former. Dagre gives correct layered positions regardless of graph
 * size, which is the whole point of solving "large pipelines" from day one
 * rather than deferring it.
 */

export const NODE_WIDTH = 216;
export const NODE_HEIGHT = 60;

export interface FlowNodeData extends Record<string, unknown> {
  jobId: string;
  jobName: string;
  severity: Severity;
  headline: string;
  isFocal: boolean;
  dimmed: boolean;
  href?: string;
  onActivate?: () => void;
}

type FlowLayout = { nodes: Node<FlowNodeData>[]; edges: Edge[] };

const PROBLEM_EDGE_COLOR = "#dc2626";
const NORMAL_EDGE_COLOR = "#a1a1aa";

/**
 * The expensive half: dagre positioning. Depends only on `graph`'s shape
 * (nodes/edges), never on dimming or click handlers, so callers should
 * memoize this on `graph` alone — see `applyGraphOverlay` for the cheap
 * per-render decoration that changes on every "focus on issues" toggle or
 * inline-callback re-render without re-running dagre.
 */
export function computeGraphLayout(graph: DependencyGraph): FlowLayout {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 28, ranksep: 88 });

  for (const node of graph.nodes) {
    g.setNode(node.jobId, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of graph.edges) {
    g.setEdge(edge.fromJobId, edge.toJobId);
  }
  dagre.layout(g);

  const nodes: Node<FlowNodeData>[] = graph.nodes.map((node) => {
    const pos = g.node(node.jobId);
    return {
      id: node.jobId,
      type: "job",
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
      data: {
        jobId: node.jobId,
        jobName: node.jobName,
        severity: node.severity,
        headline: node.headline,
        isFocal: node.jobId === graph.focalJobId,
        dimmed: false,
        href: undefined,
        onActivate: undefined,
      },
    };
  });

  const edges: Edge[] = graph.edges.map((edge) => {
    const color = edge.isProblem ? PROBLEM_EDGE_COLOR : NORMAL_EDGE_COLOR;
    return {
      id: `${edge.fromJobId}->${edge.toJobId}`,
      source: edge.fromJobId,
      target: edge.toJobId,
      type: "smoothstep",
      style: {
        stroke: color,
        strokeWidth: edge.isProblem ? 2.25 : 1.5,
        strokeDasharray: edge.isProblem ? "1,5" : undefined,
        opacity: 1,
      },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
    };
  });

  return { nodes, edges };
}

export interface GraphOverlayOptions {
  dimmedIds?: Set<string>;
  getJobHref?: (jobId: string) => string;
  onJobSelect?: (jobId: string) => void;
}

/**
 * The cheap half: dimming and click-doorway wiring on top of an
 * already-positioned layout. A plain `.map()` over however many nodes are
 * in the graph — no dagre — so re-deriving this on every "focus on issues"
 * toggle or on a host passing fresh inline `onJobSelect`/`getJobHref`
 * closures each render costs nothing worth memoizing away.
 */
export function applyGraphOverlay(base: FlowLayout, { dimmedIds = new Set<string>(), getJobHref, onJobSelect }: GraphOverlayOptions = {}): FlowLayout {
  const nodes = base.nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      dimmed: dimmedIds.has(node.data.jobId),
      href: node.data.isFocal ? undefined : getJobHref?.(node.data.jobId),
      onActivate: node.data.isFocal ? undefined : onJobSelect ? () => onJobSelect(node.data.jobId) : undefined,
    },
  }));

  const edges = base.edges.map((edge) => ({
    ...edge,
    style: { ...edge.style, opacity: dimmedIds.has(edge.source) || dimmedIds.has(edge.target) ? 0.25 : 1 },
  }));

  return { nodes, edges };
}
