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
MISSION.md               — product mission and architectural principles (read first)
package.json              — npm workspaces root ("packages/*", "web")
packages/embed/            — @schedio/embed: the model + UI, published as a component
packages/connector-airflow/ — @schedio/connector-airflow: maps an Airflow 3 instance into the model
web/                       — our own hosted app; a thin consumer of @schedio/embed
```

## Commands

Install once from the repo root (`npm install`) — this links `web/`'s
`@schedio/embed` dependency to the local `packages/embed` workspace.

```bash
# packages/embed/ — the component package
npm run build --workspace=packages/embed   # tsup (JS+types) + scoped CSS -> dist/
npm run typecheck --workspace=packages/embed
npm run lint --workspace=packages/embed

# packages/connector-airflow/ — the Airflow connector package
npm run build --workspace=packages/connector-airflow      # tsup (JS+types) -> dist/
npm run typecheck --workspace=packages/connector-airflow
npm run lint --workspace=packages/connector-airflow
npm run test --workspace=packages/connector-airflow       # node --test, fixture-based, no live Airflow needed

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

`packages/embed` and `web/` have no test suite — verification there is
typecheck + lint + build, plus a manual/Playwright smoke pass (see
"Shipping a UI change" below). `packages/connector-airflow` does have
fixture-based tests (`node --test`, no test-framework dependency added) —
its mapping logic is pure functions worth pinning down, and there's no
live Airflow instance in this environment to smoke-test against instead.

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
                getJobDetail, getDependencyGraph, all async)
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
internal `usePromise` hook rather than `useMemo`. `ConnectorSnapshot.scopes`
is reported by the connector too, not a static list — a real backend has
no other way to tell Schedio what teams/instances/tags exist. Every
snapshot `prepareData()` prepares is guaranteed to have exactly one `kind:
"all"` scope (synthesized if a connector's own snapshot doesn't include
one) — a connector author doesn't need to remember this, it's not a
contract that can be silently gotten wrong.

`Job` also carries an optional `sourceUrl`/`sourceLabel` — a deep link back
to that job in whatever system reported it (an Airflow DAG's grid view, a
Dagster asset page, ...). Generic and connector-agnostic by design: one
pair of fields any connector can populate, rather than Schedio's model
knowing about any specific backend's URL scheme. `getJobDetail` carries it
through unchanged into `JobDetailView` (raw passthrough, not triage logic —
this is why it's wired in `model/index.ts`, not `compute.ts`), and
`JobDetail` renders it as an "Open in {sourceLabel}" link next to the job's
name, only when set. `mockConnector` never sets it (there's no real system
behind it to open); `createAirflowConnector` always does, pointing at
`{uiBaseUrl ?? baseUrl}/dags/{dag_id}/grid`.

### Multiple connectors, and real (non-mock) connector packages

`combineConnectors` (in `model/connector.ts`, exported from the package
root) merges several `ConnectorFn`s — several instances of the same
backend, or entirely different backends — into one, so `GlanceView`/
`JobDetail`/`PipelineGraphView` still only ever see a single `connector`
prop; no component changes when a host adds a connector. It namespaces
every job/scope id itself, keyed by whatever the caller names each
connector in the `Record<string, ConnectorFn>` it's given — it does not
trust an individual connector to self-namespace, since a mismatch between
a connector's own internal identity and the key it's registered under
would otherwise silently corrupt the merge. One source failing outright
(`Promise.allSettled`) doesn't take the others down; each source's own
`reachable`/`lastSyncedAt` surfaces independently via the snapshot's
optional `sources` field.

That field reaches the UI too, not just the model: `getAllScopeStatuses`
(`model/index.ts`) turns it into `SourceStatus[]` — one entry per source,
in registration order, `statusCopy` already rendered as plain language
("Synced 12s ago" / "Unreachable") the same way every other piece of copy
in this layer is computed rather than left for a component to derive.
`GlanceView` renders it via `SourceStatusStrip`
(`components/glance/SourceStatusStrip.tsx`) only when `sources` is
present — a single (non-combined) connector has nothing to show here, since
its one source's reachability is already covered by its scopes' own
`connectorReachable`. This answers "is Airflow-staging itself up" directly,
without needing to infer a whole backend's health from a drop in job
counts across its scopes.

Real (non-mock) connectors live as **separate workspace packages**, never
inside `packages/embed` itself — `packages/connector-airflow/` is the
first one. This is the whole point: installing/using the Airflow connector
must not pull Dagster's SDK (or anything else) into a build that never
imports it, and `packages/embed` has zero dependency on any specific
connector, ever. A connector package's only dependency on `@schedio/embed`
is `import type` (compiles away — verify with `grep schedio/embed
dist/index.js` after building any connector package; it should find
nothing). See `packages/connector-airflow/README.md` for the concrete
DAG→Job/DagRun→Run mapping and its documented limitations, and follow that
package's shape (one factory export, a required `id` config field, fixture
tests via `node --test` rather than a new test-framework dependency) when
adding another.

### Polling

Schedio doesn't get pushed updates from a real backend — freshness comes
entirely from `usePromise` (`components/glance/usePromise.ts`) re-running
the connector on a timer. `pollIntervalMs` is a property *on the
`ConnectorFn` value itself* (`connector.pollIntervalMs = 45_000`), not a
prop on `GlanceView`/`JobDetail`/`PipelineGraphView` — set once wherever
the connector is configured (e.g. `createAirflowConnector({
pollIntervalMs, ... })`), every component rendering that connector
inherits it automatically, and `resolvePollIntervalMs` (`model/connector.ts`)
is the one place that resolves "unset → `DEFAULT_POLL_INTERVAL_MS` (30s)",
"`0` → disabled" consistently everywhere it's read. `combineConnectors`
computes its own `pollIntervalMs` from its sources — fastest active source
wins; only fully disabled if every source is. All three top-level
components call `resolvePollIntervalMs(connector ?? mockConnector)` and
pass the result as `usePromise`'s third argument — don't add a new fetch
path that skips this, or that view silently won't poll.

`usePromise`'s polling pauses on `document.visibilitychange` (skips fetch
work for a backgrounded tab) and refetches immediately the moment the tab
becomes visible again rather than waiting out the rest of the current
interval — verified end-to-end with a real browser test (a counting
connector on a short interval, checked before/after simulated
visibility changes), not just reasoned through.

**Known tradeoff, not yet solved:** `PipelineGraphView`'s auto-fit-camera
effect (`DependencyGraphCanvas`) keys on the `graph` object reference, so
every poll tick re-fits the camera even when nothing meaningful changed —
overriding a manual pan/zoom the user did in between polls. Fine for "open
the page and watch it," annoying for "actively exploring a large pipeline
while it happens to poll." Fixing this properly needs a content-based diff
(same node/focus set) instead of reference equality; see the comment at
the `usePromise` call site in `PipelineGraphView.tsx`.

### Access control (RBAC)

Schedio doesn't own identity — no login, no user store, no role hierarchy.
A host embedding it already has one; RBAC is a seam like data and
branding, not a feature Schedio implements itself. It splits into two
independent pieces:

**Visibility** (which scopes a viewer can see) is `withScopeAccess`
(`model/connector.ts`), a `ConnectorFn -> ConnectorFn` wrapper in the same
spirit as `combineConnectors` — filters `scopes`/`jobs`/`runsByJobId`/
`reachableScopeIds`/`sources` down to an allowed set (or passes through
unchanged for `"all"`) before the snapshot ever reaches `compute.ts`. Two
things it has to do carefully, both covered by proof-script verification
before this shipped: drop any `dependsOn` id pointing into a filtered-out
scope (otherwise it leaks a raw id into `JobDetailView.dependsOnNames` and
crashes `buildDependencyGraph`, which builds every node from a `statusMap`
that no longer has an entry for it — see "an honest gap beats a misleading
edge", the same call `@schedio/connector-airflow` makes for dependencies it
can't map), and drop any `"all"`-kind scope the connector reported itself
(it aggregated over jobs that are about to disappear — `prepareData()`'s
`withAggregateScope()` synthesizes a fresh one over exactly what's left, so
this doesn't need to be special-cased). Composable with `combineConnectors`
in either order — wrap a single source before combining (unprefixed scope
ids) or wrap the merged result (prefixed) — because it's just another
`ConnectorFn` transform.

**How strong a guarantee this is depends on where `connector` runs.**
`GlanceView`/`JobDetail` are client components that call it directly in the
browser, so wrapping it there stops restricted data from ever reaching
Schedio's rendered UI or React state — but the connector's raw network
response is still visible to anyone with dev tools open before this
function discards the disallowed parts, the same as any client-side check.
A real boundary against that means running the connector (with this
wrapper) somewhere the viewer can't inspect the traffic instead — which is
exactly what the pieces below are for, and what `web/` actually does.

**Running a connector server-side needs its own package entry point.**
`src/index.ts` (the package root) bundles the components together with the
model layer under one `"use client"` banner, since that's what the
components need in the browser — but a bundler enforcing React Server
Component boundaries (Next.js included) then treats *everything* in that
bundle as client-only, plain model functions like `mockConnector` included,
and refuses to let server-only code call them. `src/server.ts` re-exports
the model layer only (`export * from "./model"`, plus `Capability`/
`Permissions`/`hasCapability` — no components, no React context providers)
and is built as a genuinely separate bundle with no `"use client"` banner,
published as the `@schedio/embed/server` subpath export. `tsup.config.ts`
takes an array of two configs rather than one (`defineConfig([...])`) to
get independent bundles with independent banners — a single `banner`
option can't be conditioned per entry point in tsup, since its callback
only receives the output format, not which entry produced it. Import
`GlanceView`/`JobDetail`/`PermissionsProvider`/etc. from the package root
as always; import `mockConnector`/`withScopeAccess`/`getGlanceView`/etc.
from `@schedio/embed/server` in anything that has to run server-side.

`serializeSnapshot`/`deserializeSnapshot` (`model/connector.ts`) flatten a
`ConnectorSnapshot`'s `Map`/`Set` fields to arrays and back — the only
parts of the shape that aren't `JSON.stringify`-safe — and
`createProxyConnector` builds the client-side half: a `ConnectorFn` that
fetches your own same-origin endpoint (whatever shape you like — query
params, headers, method) instead of a backend directly. Framework-agnostic
by design, same as everything else in `model/connector.ts` — no
`next/server` import anywhere in this file, so the identical pattern works
behind an Express route or anything else that returns JSON.

**Capabilities** (which actions a viewer may take) is `Capability`/
`Permissions`/`hasCapability` (`permissions/types.ts`) plus
`PermissionsProvider`/`usePermissions` (`permissions/PermissionsProvider.tsx`)
— a context mirroring `TenantConfigProvider` exactly (one value prop, no
internal "switch user" state, defaults to `FULL_ACCESS_PERMISSIONS` when
unwrapped so RBAC stays fully opt-in). Nothing in `packages/embed` renders
a write action yet (`MISSION.md`'s "read-first, write-second"), so this has
zero consumers today — it exists so the first write feature gates itself
with a one-line `hasCapability` check against an already-established shape
instead of inventing a mechanism under deadline. Real enforcement for any
write, once one exists, always happens server-side (proxied through the
model boundary to the native engine); a `Capability` check only decides
what the UI offers to attempt.

Deliberately **not** in `packages/embed`: named role presets ("Viewer"/
"Admin"). Only the raw `{ scopeIds, capabilities }` primitives are
exposed — a host maps its own IdP roles/groups into that shape however it
wants, rather than Schedio inventing a role taxonomy that competes with
whatever the host's real auth system already has.

`web/`'s own demo has no real login, so it fakes one the same way it fakes
multiple tenants/connectors — but the actual data-fetching seam is real,
not mocked: `web/src/app/api/snapshot/route.ts` is a Route Handler that
imports from `@schedio/embed/server` and is the *only* place that decides
a request's `Permissions`, reading `admin` / `data-platform-viewer` /
`payments-viewer` from an httpOnly cookie (`PREVIEW_USER_COOKIE`,
`web/src/lib/mockUsers.ts`) rather than trusting anything client-supplied
— `setPreviewUser` (`web/src/lib/previewUserActions.ts`, a `"use server"`
Server Function) is the only thing that can set it. The route applies
`withScopeAccess` server-side and returns an already-filtered,
`serializeSnapshot`'d response; client-side, `useScopedConnector`
(`web/src/components/`) builds a `createProxyConnector` that fetches it,
and every `*Connected` component gets its connector from that one hook so
the server-side filter can't be bypassed by any individual view fetching a
connector directly. `mode` (single vs. combined) still travels as a query
param — it only selects which mock dataset to use, no access implications
— and the route expands a restricted user's base scope ids per-region
itself when combined mode is active, so a restricted viewer sees their
team on every instance, not just whichever region happened to come first.

A `"use server"` file may only export async functions — a real constraint
this hit directly, since `PREVIEW_USER_COOKIE` (a plain string) couldn't
live in the same file as `setPreviewUser` and had to move to
`mockUsers.ts` instead. `setUserId` (`AppPermissionsProvider`) awaits the
cookie-setting action before flipping local state, so the connector
identity change that triggers `usePromise`'s immediate refetch never races
the request that's supposed to have already updated the cookie by then.
Like every other preview switcher here, the client-visible selection is
in-memory and resets on a hard reload; a real deployment resolves
`Permissions` from a verified session on every request instead of a mock
user cookie, but the shape — server decides identity, client never does —
is the same either way.

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

Both components also carry the standard React component-library escape
hatches (`forwardRef`, `className`/`style` merged onto the root,
`renderLoading`/`renderNotFound` overrides) — see `packages/embed/README.md`
for the full props reference. Keep these in sync if you add new top-level
components: a component meant to be embedded that can't be ref'd, styled,
or have its loading state overridden doesn't fit the pattern.

### The dependency graph

`components/graph/` is a real graph view, not text pill lists: `JobDetail`
embeds a compact "job plus one hop each way" neighborhood inline (computed
free-of-charge inside `getJobDetail`, via a shared `buildDependencyGraph`
helper in `model/index.ts` — no second connector round-trip just to draw a
few nodes it already has data for); `PipelineGraphView` is the "view full
pipeline" destination, a separate top-level component for the whole
connected pipeline, mounted at its own host route the same way
`JobDetail`/`GlanceView` are (`getPipelineHref`/`onViewPipeline` on
`JobDetail`, the same doorway pattern as everywhere else). Both render
through the shared `DependencyGraphCanvas`.

An edge renders differently when its upstream node is a live cause of
downstream trouble (`isProblem` in `GraphNode`/`GraphEdge`, computed in
`model/index.ts` straight from the already-computed `statusMap` —
`compute.ts` gains no new logic for this). Node color/severity styling
reuses `SEVERITY_VISUAL` from `components/glance/visuals.ts` — the graph
introduces zero new colors or vocabulary to learn.

Two dependencies exist solely for this: `@dagrejs/dagre` (auto-layout —
hand-computed columns don't hold up once a pipeline is more than a few
hops) and `@xyflow/react` (pan/zoom/render). Both are regular
`dependencies` in `packages/embed/package.json`, like `lucide-react`
already was — tsup leaves them external and `npm install`ing
`@schedio/embed` pulls them in transitively, nothing extra for a host.
`PipelineGraphView` defaults to auto-focusing the camera on whatever's
broken (plus one hop of context) rather than fitting the whole graph once
a pipeline passes ~15 jobs — see `seed-data.ts`'s "Core Platform" scope (a
deliberately large ~60-job pipeline with a scripted cascading failure in
`connector.ts`) for the scenario this is stress-tested against.

**CSS gotcha if you touch this again:** React Flow's own stylesheet must
only be imported via `src/styles.css` (which `build-css.mjs` scopes under
`.schedio-embed-root` like everything else) — never `import
"@xyflow/react/dist/style.css"` directly in a component. tsup leaves that
import in the compiled `dist/index.js` verbatim (unlike Tailwind classes,
CSS `@import`s aren't scoped by our build), which would leak React Flow's
unscoped base styles straight onto the host's page.

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

Three things exist purely to exercise edge cases that would otherwise
require hand-editing mock data, and none should be mistaken for a real
product feature: the connector-outage simulator (`DemoControls`, exported
from the package but only rendered by `GlanceView` when no custom
`connector` prop is passed — see `showDemoControls` on `GlanceViewProps`),
the tenant preview switcher, and the "Data source: Single / Combined"
switcher (`web/src/components/ConnectorModeSwitcher.tsx` +
`AppConnectorProvider.tsx`) — all `web/`-only, all rendered together from
`PreviewControlsBar.tsx`. The combined mode wires two copies of the mock
connector through `combineConnectors` under different keys ("us-east"/
"eu-west", each relabeled via a small `withRegionLabel` wrapper in
`web/src/lib/demoConnectors.ts`) — it's the same pattern a real deployment
would use with `@schedio/connector-airflow` for two real Airflow
instances, just without needing one to actually exist in this environment.

**Job ids can contain `:` once `combineConnectors` is in play**
(`"us-east:build-revenue-facts"`), and this Next.js version does **not**
auto-decode dynamic route segment params the way you'd expect from
training-data knowledge of Next.js (confirmed empirically, not assumed —
see `web/AGENTS.md`'s warning about this). `web/src/lib/jobRoutes.ts`'s
`jobHref`/`jobPipelineHref` encode job ids going out; both
`jobs/[id]/page.tsx` and `jobs/[id]/pipeline/page.tsx` call
`decodeURIComponent` on `params.id` coming back in. If you add another
route that takes a job id, follow the same pair — skipping either half
breaks silently (a raw colon looks like a valid path segment right up
until `getJobDetail` fails to find a job with the literal `%3A`-encoded
id).

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
