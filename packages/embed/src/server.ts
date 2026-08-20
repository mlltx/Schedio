/**
 * @schedio/embed/server — the model layer only: connectors, `withScopeAccess`,
 * `getGlanceView`/`getJobDetail`/etc., with zero React or DOM dependency.
 * Import from here (not the package root) in code that has to run
 * somewhere a viewer can't inspect it — a Next.js Server Component, a
 * Route Handler, any other server-only environment.
 *
 * This split exists because of how the package root is built: tsup bundles
 * every component (GlanceView, JobDetail, ...) and the model layer into one
 * `"use client"`-banner'd file, since that's what the components need to
 * work in the browser. A bundler enforcing React Server Component
 * boundaries (like Next.js) then treats *everything* in that file as
 * client-only — including plain functions like `mockConnector` or
 * `withScopeAccess` that have no React dependency at all — and refuses to
 * let server-only code call them. This entry point is built separately,
 * with no such banner, so the model layer stays callable from both sides.
 *
 * See `withScopeAccess`'s own docs and `web/`'s `app/api/snapshot/route.ts`
 * for why running a connector server-side matters in the first place: a
 * connector wrapped in `withScopeAccess` inside a client component still
 * puts its unfiltered network response within reach of anyone with dev
 * tools open. Importing from here instead of the package root is what
 * actually closes that gap.
 */
export * from "./model";

// Permissions/Capability are plain data too (PermissionsProvider, the React
// context half, stays client-only and is exported only from the package
// root) — resolving a Permissions value from a session and passing it to
// withScopeAccess is exactly the kind of thing server-only code needs this
// entry point for.
export { FULL_ACCESS_PERMISSIONS, hasCapability } from "./permissions/types";
export type { Capability, Permissions } from "./permissions/types";
