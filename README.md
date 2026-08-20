# Schedio

A backend-agnostic visual model for scheduled work (cron/Airflow/Dagster/
Temporal/Prefect-style jobs), plus a best-in-class UI on top of it. The
model and the interface are the product — not another scheduler. See
[`MISSION.md`](./MISSION.md) for the full mission and the architectural
principles behind everything in this repo.

## What's here

Schedio ships in two forms from one source:

- **[`packages/embed`](./packages/embed)** — `@schedio/embed`, a
  publishable React/Next.js component. Drop it into a site you already
  have; see [its README](./packages/embed/README.md) for install and
  usage.
- **[`web`](./web)** — our own hosted app. It's `@schedio/embed` with our
  chrome and demo data around it, nothing more — proof that the package
  genuinely works standalone, since we consume our own published
  component the same way an outside team would.

## Getting started

```bash
npm install   # from the repo root — sets up the npm workspace
npm run dev --workspace=web
```

Then open http://localhost:3000.

If you're developing on `packages/embed`, see its README for the package
API, and the root [`CLAUDE.md`](./CLAUDE.md) for how the two pieces fit
together (in particular: `web/` depends on the package's *compiled*
output, so a source change there needs a rebuild before `web/` sees it).

## For AI coding agents

[`CLAUDE.md`](./CLAUDE.md) documents the architecture, commands, and
non-obvious conventions in more depth than this file — read it before
making changes.
