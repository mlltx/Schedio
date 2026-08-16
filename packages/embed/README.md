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
  return <JobDetail jobId={jobId} backHref="/status" onBack={() => router.push("/status")} />;
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
  // fetch from your own scheduler/API and return raw Job/Run data in
  // Schedio's model shape — the exported Job, Run, Schedule, Sla,
  // Scope, RunStatus, Cadence types describe exactly what's expected.
  return {
    jobs: [...],
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

## Props reference

**`GlanceView`**

| Prop | Type | Default | |
|---|---|---|---|
| `connector` | `ConnectorFn` | built-in mock | where the data comes from |
| `showDemoControls` | `boolean` | `true` iff no `connector` passed | the connector-outage simulator |
| `getJobHref` | `(jobId) => string` | — | real `href` for exception rows |
| `onJobSelect` | `(jobId) => void` | — | client-side routing callback |
| `renderLoading` | `() => ReactNode` | built-in skeleton | shown while the first fetch is in flight |
| `className`, `style` | — | — | merged onto the root element |
| `ref` | `Ref<HTMLDivElement>` | — | forwarded to the root element |

**`JobDetail`**

| Prop | Type | Default | |
|---|---|---|---|
| `jobId` | `string` | required | |
| `connector` | `ConnectorFn` | built-in mock | |
| `backHref` | `string` | — | real `href` for "Back to glance" |
| `onBack` | `() => void` | — | client-side routing callback |
| `renderLoading` | `() => ReactNode` | built-in skeleton | |
| `renderNotFound` | `() => ReactNode` | built-in message | shown (below the back link) when `jobId` doesn't resolve |
| `className`, `style` | — | — | merged onto the root element |
| `ref` | `Ref<HTMLDivElement>` | — | forwarded to the root element |

`getJobHref`/`onJobSelect` and `backHref`/`onBack` are composable the same
way `next/link` works internally: give a real href for accessibility/
middle-click, a callback for client-side routing, or both.

## What's exported but not part of the core two components

`TenantSwitcher` and `DemoControls` are exported for anyone building a
similar admin/preview surface, but `GlanceView` doesn't render a tenant
switcher itself — a real deployment has exactly one brand. See `web/`'s
own `TenantSwitcherBar`/`AppTenantProvider` for the intended pattern if
you want the same "preview several configs" behavior we use for our own
demo.

`getScopes`, `getGlanceView`, `getJobDetail` are also exported directly if
you want to build your own UI on top of the same computed data instead of
using `GlanceView`/`JobDetail` as-is.
