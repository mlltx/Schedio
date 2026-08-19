import type { Terminology } from "@/model";

/**
 * A deployment's identity: what to call this product and the things in it,
 * and what color to accent it with. This is the entire surface a team needs
 * to touch to make Schedio theirs — no component should have a hardcoded
 * "Schedio", "job", or brand color outside of what flows through here.
 *
 * Terminology itself is defined in the model layer (compute.ts is what
 * actually turns it into sentences) — this config just supplies a value for
 * it, the same way it supplies a value for brand color.
 *
 * Deliberately NOT included: severity colors (healthy/critical/etc). See
 * the "White-label by design" principle in MISSION.md for why — comprehension
 * depends on those meaning the same thing everywhere, so they're fixed
 * regardless of tenant.
 */

export interface BrandColors {
  /** Hex string. Used for chrome accents: selected states, focus rings, links. */
  primary: string;
  /** Hex string. Text/icon color placed on top of `primary`. */
  primaryForeground: string;
}

export interface Brand {
  productName: string;
  colors: BrandColors;
}

export type { Terminology };

export interface TenantCopy {
  /** Heading above the exception list, e.g. "Needs a look". */
  exceptionsHeading: string;
  /** `JobDetail`'s link back to the glance view, e.g. "Back to glance". */
  backToGlance: string;
  /** `PipelineGraphView`'s link back to the job it was opened from, e.g. "Back to job". */
  backToJob: string;
  /**
   * Plural form of what to call a scope grouping in `ScopeSwitcher`'s
   * picker trigger, e.g. "Teams" (shown as "Teams (8)"). Not part of
   * `Terminology` — that's the model's own vocabulary for job/run;
   * "team" is purely a UI label for how scopes are presented.
   */
  scopesLabel: string;
  /** Singular form, e.g. "team" — used in "Find a team..." and "No teams match". */
  scopeLabel: string;
  /** `JobDetail`'s inline dependency graph heading, e.g. "Dependency graph". */
  dependencyGraphHeading: string;
  /** Link from `JobDetail`'s inline graph to the full `PipelineGraphView`, e.g. "View full pipeline". */
  viewFullPipeline: string;
  /** `JobDetail`'s expected-duration stat label, e.g. "Usually takes". */
  usuallyTakesLabel: string;
  /** `JobDetail`'s historical failure-rate stat label, e.g. "Historical failure rate". */
  historicalFailureRateLabel: string;
  /** `JobDetail`'s "is today typical" stat label, e.g. "Today". */
  todayLabel: string;
  /** Values for the "Today" stat, e.g. "Typical" / "Unusual". */
  typicalLabel: string;
  unusualLabel: string;
  /** Fallback for "Open in {sourceLabel}" when a job has a `sourceUrl` but no `sourceLabel`, e.g. "source". */
  genericSourceLabel: string;
  /** `PipelineGraphView`'s own heading, e.g. "Full pipeline". */
  fullPipelineHeading: string;
  /** `PipelineGraphView`'s issue-filter toggle, e.g. "Focus on issues" / "Focused on issues". */
  focusOnIssuesLabel: string;
  focusedOnIssuesLabel: string;
  /** `PipelineGraphView`'s zoom-extent toggle, e.g. "Fit to full pipeline" / "Fit to issues". */
  fitToFullPipelineLabel: string;
  fitToIssuesLabel: string;
  /** `ScopeSwitcher`'s empty search-result state, shown as `{noScopesMatchLabel} "{query}"`, e.g. "No teams match". */
  noScopesMatchLabel: string;
}

export interface TenantConfig {
  id: string;
  brand: Brand;
  terminology: Terminology;
  copy: TenantCopy;
}
