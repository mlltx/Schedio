# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Schedio: a backend-agnostic visual model for scheduled work (cron/Airflow/
Dagster/Temporal/Prefect-style jobs), plus a best-in-class UI on top of it.
The product is the model and the interface — not a scheduler. See
`MISSION.md` at the repo root for the full mission and the non-negotiable
architectural principles; read it before making product or architecture
decisions, not just this file.

The single most important rule from `MISSION.md`, restated because it's
easy to violate by accident: **the UI only ever reads computed output from
`web/src/model/index.ts`.** Never let a component import from
`web/src/model/types.ts`, `connector.ts`, or `compute.ts` directly, and
never re-derive status/severity logic in a component — that logic belongs
in `compute.ts`, in one place.

## Repo layout

```
MISSION.md   — product mission and architectural principles (read first)
web/         — the Next.js app; everything else in this file is about web/
```

All commands below are run from `web/`.

## Commands

```bash
npm run dev      # dev server, Turbopack, http://localhost:3000
npm run build    # production build (also type-checks)
npm run start    # serve a production build (after npm run build)
npm run lint     # eslint (eslint-config-next core-web-vitals + typescript)
npx tsc --noEmit # type-check only, faster than a full build
```

There is no test suite (no test script, no test framework installed).
Verification is: `npx tsc --noEmit`, `npm run lint`, `npm run build`, and a
manual/Playwright smoke pass — see "Shipping a UI change" below.

## Architecture

### The model/UI boundary

```
web/src/model/
  types.ts      raw Job/Run/Scope shapes (internal) + computed JobStatus/
                ScopeStatus/JobDetailView shapes (what the UI may read) +
                Terminology (see "Tenant config" below)
  seed-data.ts  curated mock jobs across several scopes/teams, with real
                dependency chains
  connector.ts  the mock connector: generates run history from seed-data,
                simulates per-scope connector reachability. Stands in for
                a real Airflow/Dagster/etc. adapter — swapping to a real
                backend means changing only this file. Scripted demo
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
                getJobDetail)
```

`web/src/components/glance/` and `web/src/app/` consume only
`@/model`'s computed types and functions — never raw `Job`/`Run` data,
never scheduler vocabulary.

### Tenant config (branding + terminology)

`web/src/config/` lets a deployment supply its own product name, brand
color, and vocabulary (what to call a "job", a "run") without touching
component or model code — see the "White-label by design" principle in
`MISSION.md`.

The dependency direction matters: `Terminology` is defined in
`web/src/model/types.ts`, not in `config/`, because `compute.ts` is what
actually turns state into sentences (e.g. "Failed and is blocking 2 other
pipelines") — the model owns the vocabulary its own copy is built from.
`config/types.ts` imports `Terminology` from `@/model`; the model never
imports from `config/`.

`TenantConfigProvider` (in `config/`) wraps the root layout and owns the
selected tenant as React state, so it persists across client-side
navigation for free — the same mechanism as any other layout-level state
in the App Router. Brand color flows through as CSS custom properties
(`--brand-primary`, `--brand-primary-foreground`) rather than Tailwind
classes, since the value is runtime data. Severity colors
(healthy/critical/etc., defined in `components/glance/visuals.ts`) are
deliberately **not** themeable per tenant — that's a guardrail from
`MISSION.md`, not an oversight.

`config/presets.ts` includes two extra example tenants beyond Schedio's
own defaults, purely to prove the boundary holds live via the "Preview as"
switcher (`TenantSwitcher.tsx`) in the glance view header.

### Demo controls

Two live toggles exist purely to exercise edge cases that would otherwise
require hand-editing mock data: the connector-outage simulator
(`DemoControls.tsx`) and the tenant preview switcher above. Both are
clearly labeled as demo/preview controls, not real product features — a
single-tenant production deployment wouldn't ship either.

### Styling

Tailwind v4. Dark mode is media-query-based (`prefers-color-scheme` in
`globals.css`), not class-based — use `dark:` variants throughout, don't
add a `dark` class toggle.

### Deployment

Deployed on Vercel with the project's **Root Directory set to `web`** in
the Vercel dashboard (there's no `vercel.json` — that setting isn't in the
repo). Deployments list:
https://vercel.com/mlltxs-projects/schedio/deployments

## Shipping a UI change

The `.claude/skills/ship-ui-change/SKILL.md` project skill governs the
workflow for any change to `web/` and should auto-trigger: make the
change, verify the dev server, screenshot the result (and any
interactions) with Playwright — Chromium is pre-installed at
`/opt/pw-browsers/chromium`, and capture scripts must be run with cwd
inside `web/` so `@playwright/test` resolves — send the screenshots,
commit, push, and point to the Vercel deployments link above. Don't commit
throwaway capture scripts.

`web/AGENTS.md` (auto-imported into `web/CLAUDE.md`) also flags that this
repo pins a very recent Next.js version with breaking changes from
training-data expectations — check `node_modules/next/dist/docs/` before
relying on remembered Next.js APIs or conventions.
