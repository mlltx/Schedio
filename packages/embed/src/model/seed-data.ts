import type { Job, Scope } from "./types";

/**
 * Hand-authored fixture jobs standing in for what a real connector (Airflow,
 * Dagster, Temporal, ...) would report. Seven team scopes on purpose: four
 * are "ordinary" teams carrying the recovering/late/missing/critical
 * scenarios, one (support-ops) is deliberately quiet so the plain "healthy"
 * headline is always demonstrable too, and two (ml-platform, quarterly-ops)
 * exist specifically to make the "no data yet" and "nothing scheduled in
 * this window" edge cases reliably demonstrable rather than luck-of-the-draw.
 */

export const SCOPES: Scope[] = [
  { id: "all", name: "All", kind: "all" },
  { id: "data-platform", name: "Data Platform", kind: "team" },
  { id: "payments", name: "Payments", kind: "team" },
  { id: "growth", name: "Growth", kind: "team" },
  { id: "infrastructure", name: "Infrastructure", kind: "team" },
  { id: "support-ops", name: "Support Ops", kind: "team" },
  { id: "ml-platform", name: "ML Platform", kind: "team" },
  { id: "quarterly-ops", name: "Quarterly Ops", kind: "team" },
  { id: "core-platform", name: "Core Platform", kind: "team" },
];

const sla = (expectedDurationMinutes: number, graceMinutes = 20) => ({
  expectedDurationMinutes,
  graceMinutes,
});

/**
 * Core Platform: a large, deep multi-layer pipeline (~60 jobs across six
 * hops) that exists specifically to stress-test the dependency graph view at
 * real scale — every other scope's chains are 2-4 hops on purpose, which is
 * enough to prove the graph's correctness but not enough to prove it holds
 * up on a pipeline a large org would actually have. See connector.ts for the
 * scripted root-cause-failure that cascades through a chunk of this graph.
 */
const platformJob = (job: Omit<Job, "owner" | "scopeId">): Job => ({
  ...job,
  owner: "Core Platform",
  scopeId: "core-platform",
});

const CORE_PLATFORM_DOMAINS = [
  "orders",
  "inventory",
  "pricing",
  "shipping",
  "support",
  "marketing",
  "web-sessions",
  "payments",
  "catalog",
  "fulfillment",
];

const domainLabel = (domain: string) => domain.replace("-", " ");

// Layer 0 — raw ingestion, one per domain, hourly.
const CORE_PLATFORM_SOURCES: Job[] = CORE_PLATFORM_DOMAINS.map((domain) =>
  platformJob({
    id: `ingest-${domain}-stream`,
    name: `Ingest ${domainLabel(domain)} stream`,
    schedule: { cadence: "hourly" },
    sla: sla(10),
    dependsOn: [],
  }),
);

// Layer 1 — clean/validate, one per domain, hourly, depends on its own source.
const CORE_PLATFORM_CLEAN: Job[] = CORE_PLATFORM_DOMAINS.map((domain) =>
  platformJob({
    id: `clean-${domain}-stream`,
    name: `Clean ${domainLabel(domain)} stream`,
    schedule: { cadence: "hourly" },
    sla: sla(15),
    dependsOn: [`ingest-${domain}-stream`],
  }),
);

// Layer 2 — enrichment, daily. Fan-in starts here (some jobs merge 2-3 clean streams).
const CORE_PLATFORM_ENRICH: Job[] = [
  platformJob({
    id: "enrich-order-records",
    name: "Enrich order records",
    schedule: { cadence: "daily", hour: 2, minute: 0 },
    sla: sla(30),
    dependsOn: ["clean-orders-stream", "clean-pricing-stream"],
  }),
  platformJob({
    id: "enrich-inventory-records",
    name: "Enrich inventory records",
    schedule: { cadence: "daily", hour: 2, minute: 15 },
    sla: sla(25),
    dependsOn: ["clean-inventory-stream", "clean-catalog-stream"],
  }),
  platformJob({
    id: "enrich-shipping-records",
    name: "Enrich shipping records",
    schedule: { cadence: "daily", hour: 2, minute: 30 },
    sla: sla(25),
    dependsOn: ["clean-shipping-stream", "clean-fulfillment-stream"],
  }),
  platformJob({
    id: "enrich-support-records",
    name: "Enrich support records",
    schedule: { cadence: "daily", hour: 2, minute: 0 },
    sla: sla(20),
    dependsOn: ["clean-support-stream"],
  }),
  platformJob({
    id: "enrich-marketing-records",
    name: "Enrich marketing records",
    schedule: { cadence: "daily", hour: 2, minute: 45 },
    sla: sla(25),
    dependsOn: ["clean-marketing-stream", "clean-web-sessions-stream"],
  }),
  platformJob({
    id: "enrich-payments-records",
    name: "Enrich payments records",
    schedule: { cadence: "daily", hour: 2, minute: 20 },
    sla: sla(20),
    dependsOn: ["clean-payments-stream"],
  }),
  platformJob({
    id: "build-customer-360",
    name: "Build customer 360 profile",
    schedule: { cadence: "daily", hour: 3, minute: 0 },
    sla: sla(40),
    dependsOn: ["clean-orders-stream", "clean-web-sessions-stream", "clean-support-stream"],
  }),
  platformJob({
    id: "build-catalog-health",
    name: "Build catalog health signal",
    schedule: { cadence: "daily", hour: 2, minute: 10 },
    sla: sla(20),
    dependsOn: ["clean-catalog-stream", "clean-inventory-stream"],
  }),
];

// Layer 3 — aggregation/modeling, daily.
const CORE_PLATFORM_AGGREGATE: Job[] = [
  platformJob({
    id: "build-revenue-aggregates",
    name: "Build revenue aggregates",
    schedule: { cadence: "daily", hour: 4, minute: 0 },
    sla: sla(35),
    dependsOn: ["enrich-order-records", "enrich-payments-records"],
  }),
  platformJob({
    id: "build-inventory-forecasts",
    name: "Build inventory forecasts",
    schedule: { cadence: "daily", hour: 4, minute: 15 },
    sla: sla(45),
    dependsOn: ["enrich-inventory-records"],
  }),
  platformJob({
    id: "build-logistics-kpis",
    name: "Build logistics KPIs",
    schedule: { cadence: "daily", hour: 4, minute: 0 },
    sla: sla(30),
    dependsOn: ["enrich-shipping-records"],
  }),
  platformJob({
    id: "build-support-quality-score",
    name: "Build support quality score",
    schedule: { cadence: "daily", hour: 4, minute: 30 },
    sla: sla(20),
    dependsOn: ["enrich-support-records"],
  }),
  platformJob({
    id: "build-attribution-model",
    name: "Build attribution model",
    schedule: { cadence: "daily", hour: 4, minute: 45 },
    sla: sla(50),
    dependsOn: ["enrich-marketing-records"],
  }),
  platformJob({
    id: "build-customer-ltv-model",
    name: "Build customer LTV model",
    schedule: { cadence: "daily", hour: 5, minute: 0 },
    sla: sla(50),
    dependsOn: ["build-customer-360"],
  }),
  platformJob({
    id: "build-catalog-quality-score",
    name: "Build catalog quality score",
    schedule: { cadence: "daily", hour: 4, minute: 10 },
    sla: sla(20),
    dependsOn: ["build-catalog-health"],
  }),
];

// Layer 4 — team-facing marts, daily.
const CORE_PLATFORM_MARTS: Job[] = [
  platformJob({
    id: "finance-revenue-mart",
    name: "Finance revenue mart",
    schedule: { cadence: "daily", hour: 6, minute: 0 },
    sla: sla(20),
    dependsOn: ["build-revenue-aggregates"],
  }),
  platformJob({
    id: "finance-margin-mart",
    name: "Finance margin mart",
    schedule: { cadence: "daily", hour: 6, minute: 15 },
    sla: sla(20),
    dependsOn: ["build-revenue-aggregates", "build-inventory-forecasts"],
  }),
  platformJob({
    id: "ops-inventory-mart",
    name: "Ops inventory mart",
    schedule: { cadence: "daily", hour: 6, minute: 0 },
    sla: sla(20),
    dependsOn: ["build-inventory-forecasts"],
  }),
  platformJob({
    id: "ops-logistics-mart",
    name: "Ops logistics mart",
    schedule: { cadence: "daily", hour: 6, minute: 10 },
    sla: sla(20),
    dependsOn: ["build-logistics-kpis"],
  }),
  platformJob({
    id: "ops-catalog-mart",
    name: "Ops catalog mart",
    schedule: { cadence: "daily", hour: 6, minute: 5 },
    sla: sla(15),
    dependsOn: ["build-catalog-quality-score"],
  }),
  platformJob({
    id: "support-ops-mart",
    name: "Support ops mart",
    schedule: { cadence: "daily", hour: 6, minute: 20 },
    sla: sla(15),
    dependsOn: ["build-support-quality-score"],
  }),
  platformJob({
    id: "marketing-performance-mart",
    name: "Marketing performance mart",
    schedule: { cadence: "daily", hour: 6, minute: 25 },
    sla: sla(20),
    dependsOn: ["build-attribution-model"],
  }),
  platformJob({
    id: "customer-health-mart",
    name: "Customer health mart",
    schedule: { cadence: "daily", hour: 6, minute: 30 },
    sla: sla(25),
    dependsOn: ["build-customer-ltv-model"],
  }),
  platformJob({
    id: "retention-mart",
    name: "Retention mart",
    schedule: { cadence: "daily", hour: 6, minute: 40 },
    sla: sla(25),
    dependsOn: ["build-customer-ltv-model", "build-support-quality-score"],
  }),
  platformJob({
    id: "growth-experiments-mart",
    name: "Growth experiments mart",
    schedule: { cadence: "daily", hour: 6, minute: 35 },
    sla: sla(20),
    dependsOn: ["build-attribution-model"],
  }),
  platformJob({
    id: "payments-risk-mart",
    name: "Payments risk mart",
    schedule: { cadence: "daily", hour: 6, minute: 12 },
    sla: sla(20),
    dependsOn: ["build-revenue-aggregates"],
  }),
  platformJob({
    id: "fulfillment-sla-mart",
    name: "Fulfillment SLA mart",
    schedule: { cadence: "daily", hour: 6, minute: 18 },
    sla: sla(20),
    dependsOn: ["build-logistics-kpis", "build-catalog-quality-score"],
  }),
];

// Layer 5 — dashboards/exports, the top of the pipeline. Several converge
// on 3-4 marts at once, deliberately, so a viewer can see at a glance which
// single upstream branch is actually the problem when only one is broken.
const CORE_PLATFORM_DASHBOARDS: Job[] = [
  platformJob({
    id: "exec-dashboard-refresh",
    name: "Exec dashboard refresh",
    schedule: { cadence: "daily", hour: 8, minute: 0 },
    sla: sla(20),
    dependsOn: ["finance-revenue-mart", "ops-logistics-mart", "customer-health-mart"],
  }),
  platformJob({
    id: "finance-board-deck-export",
    name: "Finance board deck export",
    schedule: { cadence: "weekly", weekday: 1, hour: 8, minute: 0 },
    sla: sla(30),
    dependsOn: ["finance-revenue-mart", "finance-margin-mart"],
  }),
  platformJob({
    id: "ops-daily-standup-export",
    name: "Ops daily standup export",
    schedule: { cadence: "daily", hour: 7, minute: 30 },
    sla: sla(15),
    dependsOn: ["ops-inventory-mart", "ops-logistics-mart"],
  }),
  platformJob({
    id: "support-weekly-review-export",
    name: "Support weekly review export",
    schedule: { cadence: "weekly", weekday: 2, hour: 8, minute: 0 },
    sla: sla(20),
    dependsOn: ["support-ops-mart", "retention-mart"],
  }),
  platformJob({
    id: "marketing-weekly-report",
    name: "Marketing weekly report",
    schedule: { cadence: "weekly", weekday: 3, hour: 8, minute: 0 },
    sla: sla(25),
    dependsOn: ["marketing-performance-mart", "growth-experiments-mart"],
  }),
  platformJob({
    id: "customer-success-digest",
    name: "Customer success digest",
    schedule: { cadence: "daily", hour: 8, minute: 10 },
    sla: sla(15),
    dependsOn: ["customer-health-mart", "retention-mart"],
  }),
  platformJob({
    id: "investor-update-package",
    name: "Investor update package",
    schedule: { cadence: "weekly", weekday: 4, hour: 8, minute: 0 },
    sla: sla(30),
    dependsOn: ["finance-revenue-mart", "customer-health-mart"],
  }),
  platformJob({
    id: "data-quality-scorecard",
    name: "Data quality scorecard",
    schedule: { cadence: "daily", hour: 8, minute: 20 },
    sla: sla(20),
    dependsOn: ["finance-revenue-mart", "ops-inventory-mart", "support-ops-mart", "marketing-performance-mart"],
  }),
  platformJob({
    id: "payments-risk-digest",
    name: "Payments risk digest",
    schedule: { cadence: "daily", hour: 8, minute: 5 },
    sla: sla(15),
    dependsOn: ["payments-risk-mart"],
  }),
  platformJob({
    id: "fulfillment-ops-review",
    name: "Fulfillment ops review",
    schedule: { cadence: "weekly", weekday: 5, hour: 8, minute: 0 },
    sla: sla(20),
    dependsOn: ["fulfillment-sla-mart"],
  }),
];

// A handful of standalone maintenance jobs with no dependency edges — pads
// the scope out the way a real platform team's backlog would, and proves
// the graph view degrades gracefully for jobs with nothing to draw.
const CORE_PLATFORM_MAINTENANCE: Job[] = [
  platformJob({
    id: "platform-warehouse-compaction",
    name: "Platform warehouse compaction",
    schedule: { cadence: "daily", hour: 1, minute: 0 },
    sla: sla(30),
    dependsOn: [],
  }),
  platformJob({
    id: "platform-metadata-catalog-refresh",
    name: "Platform metadata catalog refresh",
    schedule: { cadence: "daily", hour: 1, minute: 30 },
    sla: sla(15),
    dependsOn: [],
  }),
  platformJob({
    id: "platform-cost-anomaly-scan",
    name: "Platform cost anomaly scan",
    schedule: { cadence: "daily", hour: 1, minute: 45 },
    sla: sla(15),
    dependsOn: [],
  }),
  platformJob({
    id: "platform-access-audit-sweep",
    name: "Platform access audit sweep",
    schedule: { cadence: "weekly", weekday: 6, hour: 3, minute: 0 },
    sla: sla(20),
    dependsOn: [],
  }),
  platformJob({
    id: "platform-schema-registry-check",
    name: "Platform schema registry check",
    schedule: { cadence: "every_6_hours" },
    sla: sla(10),
    dependsOn: [],
  }),
  platformJob({
    id: "platform-query-cache-warmup",
    name: "Platform query cache warmup",
    schedule: { cadence: "hourly" },
    sla: sla(10),
    dependsOn: [],
  }),
];

const CORE_PLATFORM_JOBS: Job[] = [
  ...CORE_PLATFORM_SOURCES,
  ...CORE_PLATFORM_CLEAN,
  ...CORE_PLATFORM_ENRICH,
  ...CORE_PLATFORM_AGGREGATE,
  ...CORE_PLATFORM_MARTS,
  ...CORE_PLATFORM_DASHBOARDS,
  ...CORE_PLATFORM_MAINTENANCE,
];

/** The job whose scripted failure cascades through Core Platform — see connector.ts. */
export const CORE_PLATFORM_INCIDENT_ROOT_ID = "ingest-orders-stream";

export const JOBS: Job[] = [
  // ---- Data Platform: hosts the "critical + blocks downstream" scenario ----
  {
    id: "ingest-events-raw",
    name: "Ingest raw events",
    owner: "Data Platform",
    scopeId: "data-platform",
    schedule: { cadence: "hourly" },
    sla: sla(10),
    dependsOn: [],
  },
  {
    id: "ingest-payments-raw",
    name: "Ingest raw payments",
    owner: "Data Platform",
    scopeId: "data-platform",
    schedule: { cadence: "hourly" },
    sla: sla(10),
    dependsOn: [],
  },
  {
    id: "clean-events",
    name: "Clean events",
    owner: "Data Platform",
    scopeId: "data-platform",
    schedule: { cadence: "hourly" },
    sla: sla(15),
    dependsOn: ["ingest-events-raw"],
  },
  {
    id: "dedupe-payments",
    name: "Dedupe payments",
    owner: "Data Platform",
    scopeId: "data-platform",
    schedule: { cadence: "hourly" },
    sla: sla(15),
    dependsOn: ["ingest-payments-raw"],
  },
  {
    id: "build-user-sessions",
    name: "Build user sessions",
    owner: "Data Platform",
    scopeId: "data-platform",
    schedule: { cadence: "daily", hour: 2, minute: 0 },
    sla: sla(45),
    dependsOn: ["clean-events"],
  },
  {
    id: "build-revenue-facts",
    name: "Build revenue facts",
    owner: "Data Platform",
    scopeId: "data-platform",
    schedule: { cadence: "daily", hour: 3, minute: 0 },
    sla: sla(40, 30),
    dependsOn: ["dedupe-payments"],
  },
  {
    id: "daily-exec-dashboard-refresh",
    name: "Daily exec dashboard refresh",
    owner: "Data Platform",
    scopeId: "data-platform",
    schedule: { cadence: "daily", hour: 6, minute: 0 },
    sla: sla(20),
    dependsOn: ["build-user-sessions", "build-revenue-facts"],
  },
  {
    id: "weekly-finance-rollup",
    name: "Weekly finance rollup",
    owner: "Data Platform",
    scopeId: "data-platform",
    schedule: { cadence: "weekly", weekday: 1, hour: 7, minute: 0 },
    sla: sla(60),
    dependsOn: ["build-revenue-facts"],
  },
  {
    id: "warehouse-vacuum",
    name: "Warehouse vacuum",
    owner: "Data Platform",
    scopeId: "data-platform",
    schedule: { cadence: "daily", hour: 1, minute: 0 },
    sla: sla(30),
    dependsOn: [],
  },
  {
    id: "schema-drift-check",
    name: "Schema drift check",
    owner: "Data Platform",
    scopeId: "data-platform",
    schedule: { cadence: "every_6_hours" },
    sla: sla(10),
    dependsOn: [],
  },

  // ---- Payments: hosts the "recovering" scenario ----
  {
    id: "capture-transactions",
    name: "Capture transactions",
    owner: "Payments",
    scopeId: "payments",
    schedule: { cadence: "hourly" },
    sla: sla(10),
    dependsOn: [],
  },
  {
    id: "reconcile-ledger",
    name: "Reconcile ledger",
    owner: "Payments",
    scopeId: "payments",
    schedule: { cadence: "hourly" },
    sla: sla(15),
    dependsOn: ["capture-transactions"],
  },
  {
    id: "detect-fraud-signals",
    name: "Detect fraud signals",
    owner: "Payments",
    scopeId: "payments",
    schedule: { cadence: "hourly" },
    sla: sla(10),
    dependsOn: ["capture-transactions"],
  },
  {
    id: "chargeback-sync",
    name: "Chargeback sync",
    owner: "Payments",
    scopeId: "payments",
    schedule: { cadence: "hourly" },
    sla: sla(10),
    dependsOn: [],
  },
  {
    id: "settle-daily-batch",
    name: "Settle daily batch",
    owner: "Payments",
    scopeId: "payments",
    schedule: { cadence: "daily", hour: 22, minute: 0 },
    sla: sla(50),
    dependsOn: ["reconcile-ledger"],
  },
  {
    id: "refund-processor",
    name: "Refund processor",
    owner: "Payments",
    scopeId: "payments",
    schedule: { cadence: "daily", hour: 5, minute: 0 },
    sla: sla(20),
    dependsOn: [],
  },
  {
    id: "payment-method-vault-sync",
    name: "Payment method vault sync",
    owner: "Payments",
    scopeId: "payments",
    schedule: { cadence: "daily", hour: 4, minute: 0 },
    sla: sla(15),
    dependsOn: [],
  },
  {
    id: "tax-calc-batch",
    name: "Tax calc batch",
    owner: "Payments",
    scopeId: "payments",
    schedule: { cadence: "daily", hour: 5, minute: 30 },
    sla: sla(25),
    dependsOn: [],
  },
  {
    id: "payout-scheduler",
    name: "Payout scheduler",
    owner: "Payments",
    scopeId: "payments",
    schedule: { cadence: "daily", hour: 8, minute: 0 },
    sla: sla(20),
    dependsOn: [],
  },

  // ---- Growth: hosts the "missing" and "late" scenarios ----
  {
    id: "ingest-marketing-events",
    name: "Ingest marketing events",
    owner: "Growth",
    scopeId: "growth",
    schedule: { cadence: "hourly" },
    sla: sla(10),
    dependsOn: [],
  },
  {
    id: "attribution-model-run",
    name: "Attribution model run",
    owner: "Growth",
    scopeId: "growth",
    schedule: { cadence: "daily", hour: 4, minute: 0 },
    sla: sla(30, 20),
    dependsOn: ["ingest-marketing-events"],
  },
  {
    id: "campaign-spend-sync",
    name: "Campaign spend sync",
    owner: "Growth",
    scopeId: "growth",
    schedule: { cadence: "hourly" },
    sla: sla(10),
    dependsOn: [],
  },
  {
    id: "lead-scoring-batch",
    name: "Lead scoring batch",
    owner: "Growth",
    scopeId: "growth",
    schedule: { cadence: "daily", hour: 5, minute: 0 },
    sla: sla(25, 20),
    dependsOn: [],
  },
  {
    id: "email-engagement-rollup",
    name: "Email engagement rollup",
    owner: "Growth",
    scopeId: "growth",
    schedule: { cadence: "daily", hour: 6, minute: 0 },
    sla: sla(20),
    dependsOn: [],
  },
  {
    id: "seo-crawl-batch",
    name: "SEO crawl batch",
    owner: "Growth",
    scopeId: "growth",
    schedule: { cadence: "daily", hour: 3, minute: 0 },
    sla: sla(40),
    dependsOn: [],
  },
  {
    id: "churn-model-refresh",
    name: "Churn model refresh",
    owner: "Growth",
    scopeId: "growth",
    schedule: { cadence: "weekly", weekday: 3, hour: 6, minute: 0 },
    sla: sla(50),
    dependsOn: [],
  },
  {
    id: "ab-test-results-sync",
    name: "A/B test results sync",
    owner: "Growth",
    scopeId: "growth",
    schedule: { cadence: "hourly" },
    sla: sla(10),
    dependsOn: [],
  },
  {
    id: "referral-program-sync",
    name: "Referral program sync",
    owner: "Growth",
    scopeId: "growth",
    schedule: { cadence: "daily", hour: 7, minute: 0 },
    sla: sla(15),
    dependsOn: [],
  },

  // ---- Infrastructure: connector for this whole scope goes unreachable ----
  {
    id: "backup-verification",
    name: "Backup verification",
    owner: "Infrastructure",
    scopeId: "infrastructure",
    schedule: { cadence: "daily", hour: 2, minute: 0 },
    sla: sla(30),
    dependsOn: [],
  },
  {
    id: "certificate-rotation-check",
    name: "Certificate rotation check",
    owner: "Infrastructure",
    scopeId: "infrastructure",
    schedule: { cadence: "daily", hour: 3, minute: 0 },
    sla: sla(10),
    dependsOn: [],
  },
  {
    id: "cost-anomaly-scan",
    name: "Cost anomaly scan",
    owner: "Infrastructure",
    scopeId: "infrastructure",
    schedule: { cadence: "daily", hour: 4, minute: 0 },
    sla: sla(15),
    dependsOn: [],
  },
  {
    id: "capacity-forecast",
    name: "Capacity forecast",
    owner: "Infrastructure",
    scopeId: "infrastructure",
    schedule: { cadence: "weekly", weekday: 2, hour: 5, minute: 0 },
    sla: sla(45),
    dependsOn: [],
  },
  {
    id: "log-retention-cleanup",
    name: "Log retention cleanup",
    owner: "Infrastructure",
    scopeId: "infrastructure",
    schedule: { cadence: "daily", hour: 1, minute: 30 },
    sla: sla(20),
    dependsOn: [],
  },
  {
    id: "secrets-rotation",
    name: "Secrets rotation",
    owner: "Infrastructure",
    scopeId: "infrastructure",
    schedule: { cadence: "weekly", weekday: 5, hour: 6, minute: 0 },
    sla: sla(15),
    dependsOn: [],
  },
  {
    id: "node-health-sweep",
    name: "Node health sweep",
    owner: "Infrastructure",
    scopeId: "infrastructure",
    schedule: { cadence: "every_6_hours" },
    sla: sla(10),
    dependsOn: [],
  },
  {
    id: "dns-config-audit",
    name: "DNS config audit",
    owner: "Infrastructure",
    scopeId: "infrastructure",
    schedule: { cadence: "daily", hour: 5, minute: 0 },
    sla: sla(10),
    dependsOn: [],
  },

  // ---- Support Ops: deliberately quiet, demonstrates plain "healthy" ----
  {
    id: "ticket-sla-sync",
    name: "Ticket SLA sync",
    owner: "Support Ops",
    scopeId: "support-ops",
    schedule: { cadence: "hourly" },
    sla: sla(10),
    dependsOn: [],
  },
  {
    id: "kb-reindex",
    name: "Knowledge base reindex",
    owner: "Support Ops",
    scopeId: "support-ops",
    schedule: { cadence: "daily", hour: 2, minute: 30 },
    sla: sla(20),
    dependsOn: [],
  },
  {
    id: "csat-rollup",
    name: "CSAT rollup",
    owner: "Support Ops",
    scopeId: "support-ops",
    schedule: { cadence: "daily", hour: 6, minute: 0 },
    sla: sla(15),
    dependsOn: [],
  },
  {
    id: "escalation-digest",
    name: "Escalation digest",
    owner: "Support Ops",
    scopeId: "support-ops",
    schedule: { cadence: "daily", hour: 7, minute: 0 },
    sla: sla(10),
    dependsOn: [],
  },

  // ---- ML Platform: newly connected, no run history at all ----
  {
    id: "feature-store-sync",
    name: "Feature store sync",
    owner: "ML Platform",
    scopeId: "ml-platform",
    schedule: { cadence: "hourly" },
    sla: sla(10),
    dependsOn: [],
  },
  {
    id: "model-training-pipeline",
    name: "Model training pipeline",
    owner: "ML Platform",
    scopeId: "ml-platform",
    schedule: { cadence: "daily", hour: 2, minute: 0 },
    sla: sla(90),
    dependsOn: [],
  },
  {
    id: "inference-batch-scoring",
    name: "Inference batch scoring",
    owner: "ML Platform",
    scopeId: "ml-platform",
    schedule: { cadence: "hourly" },
    sla: sla(15),
    dependsOn: [],
  },

  // ---- Quarterly Ops: monthly cadence, essentially never due "today" ----
  {
    id: "quarterly-tax-filing-prep",
    name: "Quarterly tax filing prep",
    owner: "Finance Ops",
    scopeId: "quarterly-ops",
    schedule: { cadence: "monthly", dayOfMonth: 1, hour: 6, minute: 0 },
    sla: sla(60),
    dependsOn: [],
  },
  {
    id: "board-report-package",
    name: "Board report package",
    owner: "Finance Ops",
    scopeId: "quarterly-ops",
    schedule: { cadence: "monthly", dayOfMonth: 1, hour: 8, minute: 0 },
    sla: sla(45),
    dependsOn: [],
  },
  {
    id: "vendor-contract-audit",
    name: "Vendor contract audit",
    owner: "Finance Ops",
    scopeId: "quarterly-ops",
    schedule: { cadence: "monthly", dayOfMonth: 15, hour: 6, minute: 0 },
    sla: sla(60),
    dependsOn: [],
  },
  ...CORE_PLATFORM_JOBS,
];

export const JOBS_BY_SCOPE: Record<string, Job[]> = JOBS.reduce(
  (acc, job) => {
    (acc[job.scopeId] ??= []).push(job);
    return acc;
  },
  {} as Record<string, Job[]>,
);
