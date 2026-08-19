# Vendoring `@schedio/embed` / `@schedio/connector-airflow` from source

Most teams should just `npm install @schedio/embed` (and, if applicable,
`@schedio/connector-airflow`) from the registry — see each package's own
README for that path. This document is for the other case: you want to
copy the *source* of one or both packages into your own repository instead
of depending on a published artifact — for example because you need to
patch something, you don't want a registry dependency at all, or you're
pulling this into an internal monorepo with its own build system.

Both packages were built with this in mind (see CLAUDE.md's "Vendorable by
construction" section for the standing conventions that keep them this
way), but there are a few things worth knowing before you start.

## `@schedio/connector-airflow`: the easy case

This package has **zero runtime dependencies** and its only reference to
`@schedio/embed` is `import type { ... } from "@schedio/embed"` — type-only
imports that TypeScript erases completely at compile time (verify
yourself: `grep schedio/embed dist/index.js` finds nothing in a built
copy). Vendoring it is close to "copy `src/`, done":

1. Copy `packages/connector-airflow/src/` into your repo.
2. You need `@schedio/embed`'s **types** to typecheck (not its runtime) —
   either `npm install @schedio/embed` as a `devDependency` for that
   alone, or vendor `packages/embed` too and point your tsconfig at its
   `dist/index.d.ts` (or its `src/`, since — see below — `packages/embed`'s
   source has no path-alias requirement either).
3. Nothing else. No CSS, no client/server split, no build-time codegen.
   Its own `README.md` documents the DAG→Job/DagRun→Run mapping if you're
   adapting it for a different Airflow version or a different scheduler
   entirely.

## `@schedio/embed`: what to know

### Option A — vendor and build once (recommended default)

Copy the whole `packages/embed` directory (including `package.json`,
`tsconfig.json`, `tsup.config.ts`, and `scripts/`), `npm install` its
declared dependencies, and run `npm run build` from inside it. That
produces the same `dist/index.js` / `dist/server.js` / `dist/style.css`
the published package ships — import from your local copy's `dist/`
exactly as the README describes for the npm-installed case. This is the
lowest-risk option because it exercises the exact same build this package
is tested against; nothing about "vendoring" changes the output.

### Option B — import the source directly into your own bundler

If you'd rather have your own Next.js/Vite/webpack build compile
`packages/embed/src/*.tsx` directly (no separate `npm run build` step),
three things were specifically kept true to make that work:

- **No path aliases.** Every internal import in `src/` is a relative
  import (`../../model`, `./cx`, ...) — nothing depends on the `@/*`
  tsconfig alias this package used to have internally. Your bundler
  doesn't need to know anything about it.
- **Client/server boundaries are literal `"use client"` directives**, one
  per file that needs it (every component, every hook, every provider —
  not just the three top-level ones), not a build-time banner injected
  only into the compiled bundle. Any bundler that understands React
  Server Components will do the right thing per file.
- **`src/server.ts` has zero component imports** — it re-exports only
  `model/` plus the RBAC primitives, so it's safe to import from
  server-only code. Keep this split if you patch anything: don't add a
  component import to a file `server.ts` (transitively) reaches.

**The one thing Option B does *not* give you for free: CSS scoping.**
`packages/embed`'s styles are only correctly isolated under
`.schedio-embed-root` after running `scripts/build-css.mjs`'s
postcss-prefix-selector pass (see `src/styles.css`'s own warning comment,
and CLAUDE.md's "Embeddability" section for exactly why a plain
descendant-combinator prefix isn't enough). If your own Tailwind config
just scans these source files directly, you will get **unscoped**
classes — this fails silently (no build error, just leaky/leaked styles),
which is a worse failure mode than a build breaking outright. You have two
choices here, in order of preference:

1. Still run `node scripts/build-css.mjs` (or `npm run build:css`) as a
   separate step and import its output `dist/style.css` — cheapest, and
   it's a fully self-contained script (reads only this package's own
   `src/styles.css`, writes only to its own `dist/`, and every dependency
   it needs — `postcss`, `@tailwindcss/postcss`, `postcss-prefix-selector`
   — is already declared in `package.json`). Nothing about it assumes the
   monorepo root; it'll run standalone from a vendored copy unmodified.
2. Reproduce the same postcss pass inside your own build pipeline —
   copy the `prefixSelector({...})` call from `scripts/build-css.mjs`
   verbatim, including its `transform` function. Do **not** reach for
   Tailwind's built-in `prefix()` option instead — that requires renaming
   every utility class in every component (a `sch:` prefix or similar),
   which is exactly the churn this approach was chosen to avoid.

### What's optional to vendor

`mockConnector`, `DemoControls`, and the two extra tenant presets in
`config/presets.ts` exist to make the demo self-running and to prove the
white-label/RBAC boundaries hold live — none of it is required to use the
package against a real connector. Fine to leave behind if you're vendoring
for production use against `@schedio/connector-airflow` (or your own
connector) and don't need the demo scaffolding.

## Keeping a patched vendor copy in sync

If you vendor rather than depend on the registry, you own merging future
changes yourself. The conventions above (relative imports, per-file
`"use client"`, the CSS build step) are the ones most likely to matter
when diffing against a newer version of this repo — CLAUDE.md documents
them as standing rules precisely so upstream changes keep following them
and your merges stay mechanical.
