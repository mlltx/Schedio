import dagre from "@dagrejs/dagre";
import { MarkerType, type Edge, type Node } from "@xyflow/react";
import type { DependencyGraph, Severity } from "@/model";

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

const PROBLEM_EDGE_COLOR = "#dc2626";
const NORMAL_EDGE_COLOR = "#a1a1aa";

export interface LayoutOptions {
  dimmedIds?: Set<string>;
  getJobHref?: (jobId: string) => string;
  onJobSelect?: (jobId: string) => void;
}

export function layoutDependencyGraph(
  graph: DependencyGraph,
  { dimmedIds = new Set<string>(), getJobHref, onJobSelect }: LayoutOptions = {},
): { nodes: Node<FlowNodeData>[]; edges: Edge[] } {
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
        dimmed: dimmedIds.has(node.jobId),
        href: node.jobId === graph.focalJobId ? undefined : getJobHref?.(node.jobId),
        onActivate: node.jobId === graph.focalJobId ? undefined : onJobSelect ? () => onJobSelect(node.jobId) : undefined,
      },
    };
  });

  const edges: Edge[] = graph.edges.map((edge) => {
    const color = edge.isProblem ? PROBLEM_EDGE_COLOR : NORMAL_EDGE_COLOR;
    const dimmed = dimmedIds.has(edge.fromJobId) || dimmedIds.has(edge.toJobId);
    return {
      id: `${edge.fromJobId}->${edge.toJobId}`,
      source: edge.fromJobId,
      target: edge.toJobId,
      type: "smoothstep",
      style: {
        stroke: color,
        strokeWidth: edge.isProblem ? 2.25 : 1.5,
        strokeDasharray: edge.isProblem ? "1,5" : undefined,
        opacity: dimmed ? 0.25 : 1,
      },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
    };
  });

  return { nodes, edges };
}
