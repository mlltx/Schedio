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
}

export interface TenantConfig {
  id: string;
  brand: Brand;
  terminology: Terminology;
  copy: TenantCopy;
}
