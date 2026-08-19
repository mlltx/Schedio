# @schedio/embed

Schedio's glance view and job detail as a reusable React component — drop
it into a site you already have and have it feel like part of that site,
not a foreign iframe. See [`MISSION.md`](../../MISSION.md) at the repo
root for the product thinking behind this; this file is just the "how do
I use it" reference.

Ships with a built-in mock connector and Schedio's own branding, so
`<GlanceView />` renders something real with zero configuration. Everything
below is about pointing it at your own data and identity instead.

## Install

Not published to a registry yet. Until then, install directly from GitHub:

```bash
npm install github:mlltx/Schedio#workspace=packages/embed
```

(If you're working inside this monorepo — e.g. `web/` — it's already
wired up as an npm workspace dependency; see the repo root `CLAUDE.md`.)

## Quick start

```tsx
import { GlanceView, TenantConfigProvider } from "@schedio/embed";
import "@schedio/embed/style.css";

export function StatusPage() {
  return (
    <TenantConfigProvider config={myBrandConfig}>
      <GlanceView
        getJobHref={(jobId) => `/status/${jobId}`}
        onJobSelect={(jobId) => router.push(`/status/${jobId}`)}
      />
    </TenantConfigProvider>
  );
}
```

```tsx
import { JobDetail } from "@schedio/embed";

export function JobStatusPage({ jobId }: { jobId: string }) {
  return (
    <JobDetail
      jobId={jobId}
      backHref="/status"
      onBack={() => router.push("/status")}
      getPipelineHref={(id) => `/status/${id}/pipeline`}
      onViewPipeline={(id) => router.push(`/status/${id}/pipeline`)}
    />
  );
}
```

```tsx
import { PipelineGraphView } from "@schedio/embed";

export function PipelinePage({ jobId }: { jobId: string }) {
  // Needs real height from its container — see "The dependency graph" below.
  return (
    <div style={{ height: "100vh" }}>
      <PipelineGraphView jobId={jobId} backHref={`/status/${jobId}`} onBack={() => router.push(`/status/${jobId}`)} />
    </div>
  );
}
```

Omit `TenantConfigProvider` entirely and you get Schedio's own name/color/
vocabulary. Omit `getJobHref`/`onJobSelect` and exception rows just aren't
clickable — the component never assumes it owns routing.

## Connecting your real data

By default, everything renders from a built-in mock connector — enough to
see every state (healthy, critical, missing, a simulated connector outage,
etc.) without hooking anything up. To show your own data, implement a
`ConnectorFn` and pass it to both components:

```ts
import type { ConnectorFn } from "@schedio/embed";

const myConnector: ConnectorFn = async (now, reachabilityOverrides) => {
  // fetch from your own scheduler/API and return raw Job/Run/Scope data in
  // Schedio's model shape — the exported Job, Run, Schedule, Sla,
  // Scope, RunStatus, Cadence types describe exactly what's expected.
  return {
    jobs: [...],
    scopes: [...], // your own teams/tags/instances — Schedio never hardcodes this
    runsByJobId: new Map([...]),
    reachableScopeIds: new Set([...]),
    lastSyncedAt: new Date().toISOString(),
  };
};
```

```tsx
<GlanceView connector={myConnector} showDemoControls={false} ... />
<JobDetail jobId={jobId} connector={myConnector} ... />
```

Nothing else changes — severity classification, status rollup, and all
plain-language copy generation are computed identically regardless of
where the raw data came from. `showDemoControls` defaults to `false` once
you pass a real `connector` (the built-in outage simulator only makes
sense against the mock).

## Linking back to the source

Any `Job` your connector returns can carry an optional `sourceUrl` (and
`sourceLabel`, e.g. `"Airflow"`) — a deep link back to that job in whatever
system reported it. When set, `JobDetail` renders it as an "Open in
{sourceLabel}" link next to the job's name, opening in a new tab. It's
generic on purpose: one field every connector can populate, rather than
Schedio needing to know about Airflow's DAG pages, Dagster's asset pages,
or anyone else's UI specifically. Leave it unset for a backend with no UI
of its own to link to — the built-in mock connector never sets it, since
there's no real system behind it to open.

```ts
const myConnector: ConnectorFn = async (now, reachabilityOverrides) => ({
  jobs: [
    {
      id: "daily_revenue_etl",
      // ...
      sourceUrl: "https://airflow.example.com/dags/daily_revenue_etl/grid",
      sourceLabel: "Airflow",
    },
  ],
  // ...
});
```

`@schedio/connector-airflow` populates both automatically — see its README.

## Staying up to date: polling

Every component re-polls its connector automatically — **every 30 seconds
by default, on by default** — so a view left open picks up new data
without the visitor doing anything. This is genuinely how fresh the data
gets: nothing here pushes updates from your backend to Schedio, it's
`ConnectorFn` called again on a timer.

The interval is configured **on the connector itself**, not as a prop on
`GlanceView`/`JobDetail`/`PipelineGraphView` — set it once where you
already configure the connector, and every component rendering it
inherits it automatically:

```ts
import type { ConnectorFn } from "@schedio/embed";

const myConnector: ConnectorFn = async (now, reachabilityOverrides) => { ... };
myConnector.pollIntervalMs = 60_000; // poll every 60s instead of the 30s default
// myConnector.pollIntervalMs = 0;   // disable polling for this connector entirely
```

`createAirflowConnector` (and any connector following the same pattern)
exposes this as a plain config field instead —
`createAirflowConnector({ pollIntervalMs: 60_000, ... })` — since setting
a function property directly isn't something a connector's own consumer
should need to know about; that's an implementation detail of how the
interval travels from the connector to the component, not part of a
connector package's own public config surface.

`combineConnectors` polls at whichever of its sources wants the fastest
cadence (a source that didn't set anything implicitly wants the 30s
default, same as any other connector) — the combined result only stops
polling if every single source explicitly disabled it.

Polling pauses while the browser tab isn't visible (Page Visibility API),
so an open-but-backgrounded tab doesn't keep hitting a real connector's
API on a timer for no one to see, and catches up with an immediate
refetch the moment the tab becomes visible again rather than waiting out
whatever's left of the current interval.

**If you're pointing this at a real backend, size the interval to your
backend's tolerance, not just Schedio's** — every poll re-runs the same
fetch that renders the view (for `@schedio/connector-airflow`, that means
re-fetching every DAG's run history, in parallel, per open tab). 30s is a
reasonable default for a handful of users; a large team or an instance
with many jobs may want a longer interval.

## Multiple connectors at once

`combineConnectors` merges several connectors — several instances of the
same backend, or entirely different backends — into one, so
`GlanceView`/`JobDetail`/`PipelineGraphView` still only ever see a single
`connector` prop:

```ts
import { combineConnectors } from "@schedio/embed";

const connector = combineConnectors({
  "airflow-prod": myAirflowProdConnector,
  "airflow-staging": myAirflowStagingConnector,
  // "dagster-core": myDagsterConnector,
});

<GlanceView connector={connector} />
```

Every job/scope id gets namespaced by its key here (`"airflow-prod:orders_etl"`),
so two sources can reuse the same raw ids without colliding — you don't
need to coordinate unique ids across connectors yourself. One source
failing outright doesn't take the rest down: the merged snapshot's
`sources` field reports each one's own `reachable`/`lastSyncedAt`
independently (`reachable` here means "this connector's fetch succeeded",
not "and every one of its scopes is currently up" — which scope is
specifically down is what per-scope `reachableScopeIds` is still for).

`GlanceView` surfaces this directly: whenever `sources` is present (i.e.
you're viewing a `combineConnectors` result), a small status strip near the
top shows one dot per source — green and just its id in the common case,
spelling out "Unreachable" inline the moment one isn't, rather than making
someone infer a whole backend is down from a drop in job counts. Nothing to
opt into; it's driven by `getAllScopeStatuses`' `sources` field, which is
`undefined` for a single (non-combined) connector and absent from the UI
accordingly.

## Access control (RBAC)

Schedio doesn't own identity — no login, no user store, no role system. A
host that embeds it already has one (its own SSO, its own IdP), and hands
Schedio the one thing it actually needs: which scopes the current viewer
may see. That's `withScopeAccess`, a connector wrapper in the same spirit
as `combineConnectors`:

```ts
import { withScopeAccess } from "@schedio/embed";

const connector = withScopeAccess(myConnector, ["data-platform", "payments"]);
// or, for an unrestricted viewer:
const connector = withScopeAccess(myConnector, "all");

<GlanceView connector={connector} />
```

A restricted scope disappears entirely — not just its jobs, but any trace
it exists at all: its scope entry, and any dependency edge a visible job
had pointing into it. It's composable with `combineConnectors` in either
order (wrap one source before combining, or wrap the merged result — scope
ids just need to be in whichever namespace you're filtering at).

**Where this actually runs matters.** `GlanceView`/`JobDetail` are client
components that call `connector` directly in the browser, so wrapping it
there is real filtering with zero setup — restricted data never reaches
Schedio's rendered UI or React state. But a technically curious viewer with
dev tools open could still see the connector's raw network response before
`withScopeAccess` discards the disallowed parts, the same as any client-side
check. If your backend already authenticates per-viewer and enforces its own
access control, this wrapper is redundant defense-in-depth and the gap
doesn't apply to you. Otherwise, close it by running the connector (with
this wrapper) somewhere the viewer can't inspect the traffic instead —
that's what the rest of this section is for.

### Running a connector server-side

`@schedio/embed/server` is a second entry point exporting the model layer
only — `mockConnector`, `withScopeAccess`, `getGlanceView`, everything in
["Connecting your real data"](#connecting-your-real-data) above — with zero
React or DOM dependency, so it's safe to import from a Server Component, a
Route Handler, or any other server-only environment. (It has to be a
separate entry point rather than something you can just import from
`@schedio/embed` server-side: the package root bundles the components
together with the model layer under one `"use client"` directive, since
that's what the components need in the browser, and a bundler enforcing
React Server Component boundaries — Next.js included — then treats
*everything* in that bundle as client-only, plain functions like
`mockConnector` included.)

`serializeSnapshot`/`deserializeSnapshot` bridge the gap a `ConnectorSnapshot`
otherwise can't cross as JSON (its `Map`/`Set` fields aren't
`JSON.stringify`-safe), and `createProxyConnector` builds the client-side
half: a `ConnectorFn` that fetches your own endpoint instead of a backend
directly.

```ts
// app/api/snapshot/route.ts (server-only)
import { mockConnector, withScopeAccess, serializeSnapshot } from "@schedio/embed/server";

export async function GET(request: Request) {
  const permissions = await resolvePermissionsFromSession(request); // your own auth
  const snapshot = await withScopeAccess(mockConnector, permissions.scopeIds)(new Date(), {});
  return Response.json(serializeSnapshot(snapshot));
}
```

```ts
// wherever you build the `connector` prop (client-side)
import { createProxyConnector } from "@schedio/embed";

const connector = createProxyConnector({
  fetchSnapshot: async (now, reachabilityOverrides) => {
    const res = await fetch("/api/snapshot");
    return res.json(); // must not throw — see createProxyConnector's own docs
  },
});

<GlanceView connector={connector} />
```

The browser now only ever receives whatever the route already decided to
send back — `permissions.scopeIds` never has to reach the client at all,
so it can't be read off the wire or overridden by an edited query param.
See `web/`'s `app/api/snapshot/route.ts` and `setPreviewUser`/
`AppPermissionsProvider` for a complete working example, including
resolving the viewer from an httpOnly cookie rather than trusting anything
client-supplied.

For actions rather than data — an eventual "acknowledge this failure" or
"retrigger this run" — pair this with `PermissionsProvider`:

```tsx
import { PermissionsProvider } from "@schedio/embed";

<PermissionsProvider permissions={{ scopeIds: ["data-platform"], capabilities: new Set(["acknowledge_run"]) }}>
  <GlanceView connector={connector} />
</PermissionsProvider>
```

Resolve one `Permissions` value from your own auth and feed it to both —
`scopeIds` into `withScopeAccess`, the whole object into `PermissionsProvider`
— so scope access and capabilities never drift out of sync as two
independently-tracked variables. Nothing in `packages/embed` renders a
write action yet (see MISSION.md's "read-first, write-second"), so
`Capability`/`hasCapability` have no consumer today — they exist so gating
the first one is a one-line check against an already-established shape,
not a new mechanism designed under deadline.

## Branding and terminology

`TenantConfigProvider` takes a single `config` prop — no config means
Schedio's own defaults:

```ts
import type { TenantConfig } from "@schedio/embed";

const myBrandConfig: TenantConfig = {
  id: "acme",
  brand: {
    productName: "Acme Ops",
    colors: { primary: "#4f46e5", primaryForeground: "#ffffff" },
  },
  terminology: { job: "pipeline", jobs: "pipelines", run: "run", runs: "runs" },
  copy: { exceptionsHeading: "Needs your attention" },
};
```

Terminology flows all the way through, including sentences the model
generates ("Failed and is blocking 2 other **pipelines**"), not just
static labels. `DEFAULT_TENANT_CONFIG` and `TENANT_PRESETS` (two extra
example configs) are exported if you want a starting point.

**Not themeable, on purpose:** severity colors (healthy/critical/etc.).
Comprehension depends on those meaning the same thing everywhere — see
"White-label by design" in `MISSION.md`.

## The dependency graph

`JobDetail` renders a compact dependency neighborhood inline — the job plus
its immediate upstream/downstream jobs — in place of a plain text list.
It's free: `getJobDetail` already computes it as part of the same fetch, no
extra round-trip. An edge is drawn differently when the upstream job is the
actual reason something downstream is stuck, using severity data the model
already computes — nothing new to derive.

For the whole connected pipeline (not just one hop), wire up
`getPipelineHref`/`onViewPipeline` on `JobDetail` and mount `PipelineGraphView`
at that route:

```tsx
import { PipelineGraphView } from "@schedio/embed";

<PipelineGraphView jobId={jobId} backHref={`/jobs/${jobId}`} onBack={() => router.push(`/jobs/${jobId}`)} />;
```

Built for real scale from the start — pipelines with dozens or hundreds of
jobs, not just the 2-4 hop chains a small team might have. Auto-layout comes
from `@dagrejs/dagre`; panning/zooming/rendering from `@xyflow/react` (both
are regular `dependencies`, so `npm install`ing `@schedio/embed` pulls them
in automatically — nothing extra for a host to add). Past ~15 jobs, the view
defaults to focusing the camera on whatever's actually broken (plus one hop
of context) rather than fitting the whole graph, with a toggle to see
everything and a search box to jump to a specific job by name.

`PipelineGraphView` fills its container — mount it somewhere with a real
height (`height: 100vh`, a flex child with a definite cross-size, etc.), not
inside normal document flow. `getDependencyGraph(jobId, { depth })` is also
exported directly if you want to build a different graph UI on the same
computed nodes/edges; omit `depth` (or pass `Infinity`) for the whole
pipeline, `1` for just the immediate neighbors.

## Props reference

**`GlanceView`**

| Prop | Type | Default | |
|---|---|---|---|
| `connector` | `ConnectorFn` | built-in mock | where the data comes from |
| `showDemoControls` | `boolean` | `true` iff no `connector` passed | the connector-outage simulator |
| `getJobHref` | `(jobId) => string` | — | real `href` for exception rows |
| `onJobSelect` | `(jobId) => void` | — | client-side routing callback |
| `renderLoading` | `() => ReactNode` | built-in skeleton | shown while the first fetch is in flight |
| `headingLevel` | `1\|2\|3\|4\|5\|6` | `1` | heading level for the banner headline — match your page's outline |
| `colorScheme` | `"system"\|"light"\|"dark"` | `"system"` | `"light"`/`"dark"` overrides the OS preference — for a host with its own toggle |
| `maxWidth` | `string \| number` | `"42rem"` | caps the root's width; use this, not `className`, for width overrides (see below) |
| `className`, `style` | — | — | merged onto the root element — additive tweaks only, not structural overrides like width |
| `ref` | `Ref<HTMLDivElement>` | — | forwarded to the root element |

**`JobDetail`**

| Prop | Type | Default | |
|---|---|---|---|
| `jobId` | `string` | required | |
| `connector` | `ConnectorFn` | built-in mock | |
| `backHref` | `string` | — | real `href` for "Back to glance" |
| `onBack` | `() => void` | — | client-side routing callback |
| `getJobHref` | `(jobId) => string` | — | real `href` for a neighbor node in the dependency graph |
| `onJobSelect` | `(jobId) => void` | — | client-side routing callback for a neighbor node |
| `getPipelineHref` | `(jobId) => string` | — | real `href` for "View full pipeline" |
| `onViewPipeline` | `(jobId) => void` | — | client-side routing callback for "View full pipeline" |
| `renderLoading` | `() => ReactNode` | built-in skeleton | |
| `renderNotFound` | `() => ReactNode` | built-in message | shown (below the back link) when `jobId` doesn't resolve |
| `headingLevel` | `1\|2\|3\|4\|5\|6` | `1` | heading level for the job name |
| `colorScheme` | `"system"\|"light"\|"dark"` | `"system"` | see `GlanceView` above |
| `maxWidth` | `string \| number` | `"42rem"` | see `GlanceView` above |
| `className`, `style` | — | — | merged onto the root element — additive tweaks only, not structural overrides like width |
| `ref` | `Ref<HTMLDivElement>` | — | forwarded to the root element |

**`PipelineGraphView`**

| Prop | Type | Default | |
|---|---|---|---|
| `jobId` | `string` | required | |
| `connector` | `ConnectorFn` | built-in mock | |
| `backHref` | `string` | — | real `href` for "Back to job" |
| `onBack` | `() => void` | — | client-side routing callback |
| `getJobHref` | `(jobId) => string` | — | real `href` for a node in the graph |
| `onJobSelect` | `(jobId) => void` | — | client-side routing callback for a node |
| `renderLoading` | `() => ReactNode` | built-in skeleton | |
| `renderNotFound` | `() => ReactNode` | built-in message | |
| `headingLevel` | `1\|2\|3\|4\|5\|6` | `1` | heading level for "Full pipeline" |
| `colorScheme` | `"system"\|"light"\|"dark"` | `"system"` | see `GlanceView` above |
| `className`, `style` | — | — | merged onto the root element |
| `ref` | `Ref<HTMLDivElement>` | — | forwarded to the root element |

No `maxWidth` here — unlike `GlanceView`/`JobDetail`, this component fills
its container rather than capping its own width; size it via the
container you mount it in.

Every `getXHref`/`onXSelect` pair above is composable the same way
`next/link` works internally: give a real href for accessibility/
middle-click, a callback for client-side routing, or both.

## What's exported but not part of the core components

`TenantSwitcher` and `DemoControls` are exported for anyone building a
similar admin/preview surface, but `GlanceView` doesn't render a tenant
switcher itself — a real deployment has exactly one brand. `DependencyGraphCanvas`
(the renderer both `JobDetail`'s inline neighborhood and `PipelineGraphView`
are built on) is exported too, if you want a custom graph layout of your
own. See `web/`'s own `TenantSwitcherBar`/`AppTenantProvider` for the
intended pattern if
you want the same "preview several configs" behavior we use for our own
demo.

`getScopes`, `getGlanceView`, `getAllScopeStatuses`, `getJobDetail`,
`getDependencyGraph` are also exported directly if you want to build your
own UI on top of the same computed data instead of using
`GlanceView`/`JobDetail`/`PipelineGraphView` as-is.
`getAllScopeStatuses(window, options)` is what `GlanceView` itself calls
internally — it fetches and classifies once and returns every scope's
`ScopeStatus` in one call, which is the one to reach for if you need more
than one scope's status (e.g. `getGlanceView` for a single scope, called
in a loop, redoes that shared work on every call).
