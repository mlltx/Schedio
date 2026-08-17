/**
 * @schedio/embed — the glance view and job detail as a reusable React
 * component. This file is the entire public surface; nothing outside it
 * is meant to be imported by a consumer (deep imports into ./model,
 * ./config, or ./components aren't a supported path and can change
 * without notice).
 *
 * The three things a host most likely needs:
 *
 *   import { GlanceView, JobDetail, TenantConfigProvider } from "@schedio/embed";
 *   import "@schedio/embed/style.css";
 *
 * See the package README for the full walkthrough.
 */

// ---------------------------------------------------------------------------
// The components you actually render.
// ---------------------------------------------------------------------------
export { GlanceView, type GlanceViewProps } from "./components/glance/GlanceView";
export { JobDetail, type JobDetailProps } from "./components/glance/JobDetail";
export type { JobNavigation } from "./components/glance/navigation";

// The job detail page embeds a compact dependency neighborhood inline;
// PipelineGraphView is its "view full pipeline" destination — a full-page
// graph of the job's entire connected pipeline. Mount it at your own route
// (e.g. /jobs/[id]/pipeline) and wire JobDetail's getPipelineHref/
// onViewPipeline to it, the same doorway pattern as everywhere else.
export { PipelineGraphView, type PipelineGraphViewProps } from "./components/graph/PipelineGraphView";

// Optional, composable pieces — useful if you're building your own layout
// around the components above rather than using them as-is.
export { TenantSwitcher } from "./components/glance/TenantSwitcher";
export { DemoControls } from "./components/glance/DemoControls";
export { DependencyGraphCanvas, type DependencyGraphCanvasProps } from "./components/graph/DependencyGraphCanvas";

// ---------------------------------------------------------------------------
// Tenant config: your branding and vocabulary.
// ---------------------------------------------------------------------------
export { TenantConfigProvider, useTenantConfig } from "./config/TenantConfigProvider";
export { DEFAULT_TENANT_CONFIG, TENANT_PRESETS } from "./config/presets";
export type { TenantConfig, Brand, BrandColors, TenantCopy } from "./config/types";

// ---------------------------------------------------------------------------
// RBAC: who can see what, and (eventually) do what. Pair `withScopeAccess`
// below with `PermissionsProvider` — one `Permissions` value, resolved once
// from your own auth, feeds both.
// ---------------------------------------------------------------------------
export { PermissionsProvider, usePermissions } from "./permissions/PermissionsProvider";
export { FULL_ACCESS_PERMISSIONS, hasCapability } from "./permissions/types";
export type { Capability, Permissions } from "./permissions/types";

// ---------------------------------------------------------------------------
// The model layer, for anyone who wants to call getGlanceView/getJobDetail
// directly (e.g. server-side, or to build a custom UI on top of the same
// computed data instead of using GlanceView/JobDetail).
// ---------------------------------------------------------------------------
export {
  getScopes,
  getGlanceView,
  getAllScopeStatuses,
  getJobDetail,
  getDependencyGraph,
  DEFAULT_TERMINOLOGY,
  mockConnector,
} from "./model";
export type {
  Scope,
  ScopeStatus,
  AllScopeStatuses,
  SourceStatus,
  JobStatus,
  JobDetailView,
  DependencyGraph,
  DependencyGraphOptions,
  GraphNode,
  GraphEdge,
  Severity,
  HeadlineKind,
  TimeWindow,
  TrendPoint,
  Terminology,
  GlanceViewOptions,
} from "./model";

// ---------------------------------------------------------------------------
// For building your own connector — the seam that replaces the mock data
// with a real backend. See MISSION.md: "connectors are thin and disposable".
// combineConnectors merges several into one (multiple instances of the
// same backend, or several different backends) — GlanceView/JobDetail/
// PipelineGraphView never know the difference; they still just take one
// `connector` prop. withScopeAccess is the RBAC seam: it filters a
// connector's own snapshot down to the scopes one viewer may see, before
// that data ever reaches compute.ts. serializeSnapshot/deserializeSnapshot/
// createProxyConnector are for running a connector (with withScopeAccess)
// server-side instead of in the browser, so a viewer's dev tools never see
// more than they're allowed to — see the "Access control" section of the
// README, and web/'s app/api/snapshot/route.ts for a working example.
// ---------------------------------------------------------------------------
export {
  combineConnectors,
  withScopeAccess,
  serializeSnapshot,
  deserializeSnapshot,
  createProxyConnector,
  DEFAULT_POLL_INTERVAL_MS,
  resolvePollIntervalMs,
} from "./model";
export type {
  ConnectorFn,
  ConnectorSnapshot,
  ConnectorSourceStatus,
  SerializedConnectorSnapshot,
  Job,
  Run,
  RunStatus,
  Schedule,
  Sla,
  Cadence,
} from "./model";
