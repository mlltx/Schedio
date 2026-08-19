import type { TenantConfig } from "./types";

/**
 * Schedio's own identity — what ships when nobody has configured anything.
 */
export const DEFAULT_TENANT_CONFIG: TenantConfig = {
  id: "schedio",
  brand: {
    productName: "Schedio",
    colors: { primary: "#18181b", primaryForeground: "#ffffff" },
  },
  terminology: { job: "job", jobs: "jobs", run: "run", runs: "runs" },
  copy: {
    exceptionsHeading: "Needs a look",
    backToGlance: "Back to glance",
    backToJob: "Back to job",
    scopesLabel: "Teams",
    scopeLabel: "team",
    dependencyGraphHeading: "Dependency graph",
    viewFullPipeline: "View full pipeline",
    usuallyTakesLabel: "Usually takes",
    historicalFailureRateLabel: "Historical failure rate",
    todayLabel: "Today",
    typicalLabel: "Typical",
    unusualLabel: "Unusual",
    genericSourceLabel: "source",
    fullPipelineHeading: "Full pipeline",
    focusOnIssuesLabel: "Focus on issues",
    focusedOnIssuesLabel: "Focused on issues",
    fitToFullPipelineLabel: "Fit to full pipeline",
    fitToIssuesLabel: "Fit to issues",
    noScopesMatchLabel: "No teams match",
  },
};

/**
 * Two more presets exist purely to prove the boundary holds: pick any of
 * these and every piece of copy in the app — model-generated sentences
 * included — should read as if the product was built for that team, with
 * zero component code changed. This is the same "prove it live" pattern as
 * the connector-outage demo control.
 */
const ACME_LOGISTICS_CONFIG: TenantConfig = {
  id: "acme-logistics",
  brand: {
    productName: "Acme Ops",
    colors: { primary: "#4f46e5", primaryForeground: "#ffffff" },
  },
  terminology: { job: "pipeline", jobs: "pipelines", run: "run", runs: "runs" },
  copy: {
    exceptionsHeading: "Needs your attention",
    backToGlance: "Back to overview",
    backToJob: "Back to pipeline",
    scopesLabel: "Fleets",
    scopeLabel: "fleet",
    dependencyGraphHeading: "Pipeline graph",
    viewFullPipeline: "View full route",
    usuallyTakesLabel: "Typically takes",
    historicalFailureRateLabel: "Historical miss rate",
    todayLabel: "Today",
    typicalLabel: "On track",
    unusualLabel: "Off track",
    genericSourceLabel: "source system",
    fullPipelineHeading: "Full route",
    focusOnIssuesLabel: "Focus on delays",
    focusedOnIssuesLabel: "Focused on delays",
    fitToFullPipelineLabel: "Fit to full route",
    fitToIssuesLabel: "Fit to delays",
    noScopesMatchLabel: "No fleets match",
  },
};

const NORTHWIND_DATA_CONFIG: TenantConfig = {
  id: "northwind-data",
  brand: {
    productName: "Northwind Watch",
    colors: { primary: "#0d9488", primaryForeground: "#ffffff" },
  },
  terminology: { job: "workflow", jobs: "workflows", run: "execution", runs: "executions" },
  copy: {
    exceptionsHeading: "Worth a look",
    backToGlance: "Back to dashboard",
    backToJob: "Back to workflow",
    scopesLabel: "Domains",
    scopeLabel: "domain",
    dependencyGraphHeading: "Workflow graph",
    viewFullPipeline: "View full workflow",
    usuallyTakesLabel: "Typical duration",
    historicalFailureRateLabel: "Historical error rate",
    todayLabel: "Today",
    typicalLabel: "Normal",
    unusualLabel: "Abnormal",
    genericSourceLabel: "system",
    fullPipelineHeading: "Full workflow",
    focusOnIssuesLabel: "Focus on errors",
    focusedOnIssuesLabel: "Focused on errors",
    fitToFullPipelineLabel: "Fit to full workflow",
    fitToIssuesLabel: "Fit to errors",
    noScopesMatchLabel: "No domains match",
  },
};

export const TENANT_PRESETS: TenantConfig[] = [
  DEFAULT_TENANT_CONFIG,
  ACME_LOGISTICS_CONFIG,
  NORTHWIND_DATA_CONFIG,
];
