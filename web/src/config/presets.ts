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
  copy: { exceptionsHeading: "Needs a look" },
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
  copy: { exceptionsHeading: "Needs your attention" },
};

const NORTHWIND_DATA_CONFIG: TenantConfig = {
  id: "northwind-data",
  brand: {
    productName: "Northwind Watch",
    colors: { primary: "#0d9488", primaryForeground: "#ffffff" },
  },
  terminology: { job: "workflow", jobs: "workflows", run: "execution", runs: "executions" },
  copy: { exceptionsHeading: "Worth a look" },
};

export const TENANT_PRESETS: TenantConfig[] = [
  DEFAULT_TENANT_CONFIG,
  ACME_LOGISTICS_CONFIG,
  NORTHWIND_DATA_CONFIG,
];
