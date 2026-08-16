# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Schedio: a backend-agnostic visual model for scheduled work (cron/Airflow/
Dagster/Temporal/Prefect-style jobs), plus a best-in-class UI on top of it.
The product is the model and the interface — not a scheduler. See
`MISSION.md` at the repo root for the full mission and the non-negotiable
architectural principles; read it before making product or architecture
decisions, not just this file.

Schedio ships in two forms from one source: `packages/embed` is a
publishable React/Next.js component (`@schedio/embed`) a team can drop
into their own site, and `web/` is our own hosted app — which is just
`@schedio/embed` with our chrome and demo data around it, nothing more.
Changes to the model or UI almost always belong in `packages/embed`;
`web/` should stay thin.

The single most important rule from `MISSION.md`, restated because it's
easy to violate by accident: **the UI only ever reads computed output from
`packages/embed/src/model/index.ts`.** Never let a component import from
`model/types.ts`, `connector.ts`, or `compute.ts` directly, and never
re-derive status/severity logic in a component — that logic belongs in
`compute.ts`, in one place.

## Repo layout

```
MISSION.md          — product mission and architectural principles (read first)
package.json         — npm workspaces root ("packages/*", "web")
packages/embed/       — @schedio/embed: the model + UI, published as a component
web/                  — our own hosted app; a thin consumer of @schedio/embed
```

## Commands

Install once from the repo root (`npm install`) — this links `web/`'s
`@schedio/embed` dependency to the local `packages/embed` workspace.

```bash
# packages/embed/ — the component package
npm run build --workspace=packages/embed   # tsup (JS+types) + scoped CSS -> dist/
npm run typecheck --workspace=packages/embed
npm run lint --workspace=packages/embed

# web/ — the hosted app
npm run dev --workspace=web       # dev server, Turbopack, http://localhost:3000
npm run build --workspace=web     # production build (also type-checks)
npm run start --workspace=web     # serve a production build
npm run lint --workspace=web
npx tsc --noEmit                  # from web/, type-check only
```

(Or `cd` into either directory and drop `--workspace=...`.)

**`web/` depends on `@schedio/embed`'s *compiled* `dist/` output, not its
source** — `dist/` is gitignored, so editing `packages/embed/src` has no
effect on the running `web/` dev server until you rebuild the package.
`web/package.json`'s `predev`/`prebuild` hooks do this automatically on
every `npm run dev` / `npm run build`, but a `tsup --watch` (already wired
as `npm run dev --workspace=packages/embed`) won't hot-reload into an
already-running `next dev` — restart it after a package rebuild. This
`predev`/`prebuild` pairing also exists so Vercel's build (which only runs
`next build` inside `web/`, scoped by the dashboard's Root Directory
setting) still builds `packages/embed` first — don't remove it.

There is no test suite (no test script, no test framework installed).
Verification is: typecheck + lint + build for both packages, and a
manual/Playwright smoke pass — see "Shipping a UI change" below.

## Architecture

### The model/UI boundary

```
packages/embed/src/model/
  types.ts      raw Job/Run/Scope shapes (internal) + computed JobStatus/
                ScopeStatus/JobDetailView shapes (what the UI may read) +
                Terminology (see "Tenant config" below)
  seed-data.ts  curated mock jobs across several scopes/teams, with real
                dependency chains
  connector.ts  the mock connector: generates run history from seed-data,
                simulates per-scope connector reachability. Scripted demo
                scenarios (a critical/blocking failure, retries in flight,
                a missing run, etc.) are anchored relative to `now`, not to
                wall-clock schedule hours or calendar dates, so every
                severity stays reliably demonstrable regardless of when
                the app is opened
  compute.ts    all triage logic lives here and only here: severity
                classification, scope status rollup, expected-vs-actual,
                baseline/normalcy, and all plain-language copy generation
  index.ts      the *only* module anything outside src/model/ may import
                from — the public API (getScopes, getGlanceView,
                getJobDetail, both async)
```

`packages/embed/src/components/glance/` consumes only `@/model`'s computed
types and functions — never raw `Job`/`Run` data, never scheduler
vocabulary. `@/*` inside the package resolves to `packages/embed/src/*`
(its own tsconfig path alias — separate from `web/`'s).

### The connector seam (real data, not just mock)

`getGlanceView`/`getJobDetail` take an optional `connector: ConnectorFn` —
`(now, reachabilityOverrides) => ConnectorSnapshot | Promise<ConnectorSnapshot>`
— defaulting to the built-in `mockConnector`. This is *the* integration
point for a real backend: implement `ConnectorFn`, pass it in, and nothing
in `compute.ts` or any component changes. Because a real connector fetches
over the network, both functions are `async`; components fetch via the
internal `usePromise` hook rather than `useMemo`.

### Embeddability: no assumed host

`GlanceView`/`JobDetail` never import `next/link` or `next/navigation` —
they don't know Next.js exists. Navigation is two optional props,
`getJobHref` (a real `href`, for accessibility/new-tab) and `onJobSelect`
(a callback for client-side routing), composable the same way
`next/link`/react-router's `Link` work internally. `web/`'s own
`GlanceViewConnected`/`JobDetailConnected` (in `web/src/components/`) show
the intended pattern: wire both props to Next's `useRouter`. A host on a
different framework wires the same two props differently; the component
doesn't care.

Styling is isolated without renaming any Tailwind class: `GlanceView`/
`JobDetail` render inside a `.schedio-embed-root` wrapper, and
`packages/embed/scripts/build-css.mjs` post-processes the compiled
Tailwind output with `postcss-prefix-selector` so every rule (including
`:root`/`body` resets) only applies inside that wrapper. A host imports
`@schedio/embed/style.css` once; it can't leak onto their page, and their
page's styles can't leak in either.

### Tenant config (branding + terminology)

`packages/embed/src/config/` lets a deployment supply its own product
name, brand color, and vocabulary (what to call a "job", a "run") without
touching component or model code — see "White-label by design" and
"Embeddable by construction" in `MISSION.md`.

The dependency direction matters: `Terminology` is defined in
`model/types.ts`, not in `config/`, because `compute.ts` is what actually
turns state into sentences (e.g. "Failed and is blocking 2 other
pipelines") — the model owns the vocabulary its own copy is built from.
`config/types.ts` imports `Terminology` from `@/model`; the model never
imports from `config/`.

`TenantConfigProvider` takes a single `config` prop and has **no internal
tenant-switching state** — a host has exactly one brand, so to "switch
tenant" they just re-render with a different `config` object. Picking
between presets live is a `web/`-only demo feature: `web/src/components/
AppTenantProvider.tsx` owns that selection state and feeds the resolved
config down to the package's provider; `TenantSwitcher` (exported from the
package) is a fully controlled presentational component with no context
coupling, so it's `web/`'s `TenantSwitcherBar.tsx` that wires it to
`AppTenantProvider`'s state — the package component itself doesn't render
a switcher and shouldn't.

Brand color flows through as CSS custom properties (`--brand-primary`,
`--brand-primary-foreground`) rather than Tailwind classes, since the
value is runtime data. Severity colors (healthy/critical/etc., defined in
`components/glance/visuals.ts`) are deliberately **not** themeable per
tenant — a guardrail from `MISSION.md`, not an oversight.

`config/presets.ts` includes two extra example tenants beyond Schedio's
own defaults, purely to prove the boundary holds live via `web/`'s
"Preview as" switcher.

### Demo controls

Two things exist purely to exercise edge cases that would otherwise
require hand-editing mock data, and neither should be mistaken for a real
product feature: the connector-outage simulator (`DemoControls`, exported
from the package but only rendered by `GlanceView` when no custom
`connector` prop is passed — see `showDemoControls` on `GlanceViewProps`)
and the tenant preview switcher above, which is `web/`-only.

### Styling (web/'s own chrome)

`web/` has its own separate, unscoped Tailwind v4 setup for its own
minimal chrome (the tenant switcher bar wrapper, page backgrounds) —
independent of `packages/embed`'s scoped build; the two never conflict.
Dark mode is media-query-based (`prefers-color-scheme` in `globals.css`),
not class-based, in both — use `dark:` variants, don't add a `dark` class
toggle.

### Deployment

Deployed on Vercel with the project's **Root Directory set to `web`** in
the Vercel dashboard (there's no `vercel.json` — that setting isn't in the
repo). The `prebuild` hook described above makes this work despite
`packages/embed` living outside that root directory. Deployments list:
https://vercel.com/mlltxs-projects/schedio/deployments

## Shipping a UI change

The `.claude/skills/ship-ui-change/SKILL.md` project skill governs the
workflow for any change to `web/` or `packages/embed` and should
auto-trigger: make the change, rebuild `packages/embed` if you touched it,
verify the dev server, screenshot the result (and any interactions) with
Playwright — Chromium is pre-installed at `/opt/pw-browsers/chromium`, and
capture scripts must be run with cwd inside `web/` so `@playwright/test`
resolves — send the screenshots, commit, push, and point to the Vercel
deployments link above. Don't commit throwaway capture scripts.

`web/AGENTS.md` (auto-imported into `web/CLAUDE.md`) also flags that this
repo pins a very recent Next.js version with breaking changes from
training-data expectations — check `node_modules/next/dist/docs/` before
relying on remembered Next.js APIs or conventions.
