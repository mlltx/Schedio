# web

Schedio's own hosted app — a thin consumer of
[`@schedio/embed`](../packages/embed). This directory almost never holds
model or UI logic itself; that lives in the package. What's here is:

- our own branding/chrome (the "Preview as" tenant switcher, page background)
- `GlanceViewConnected`/`JobDetailConnected` — the two-line wiring that
  connects the package's framework-agnostic navigation props
  (`getJobHref`/`onJobSelect`) to Next's router, showing the pattern any
  host app would follow
- deploy config for our own Vercel project

See the repo root [`README.md`](../README.md) and
[`MISSION.md`](../MISSION.md) for the bigger picture, and
[`CLAUDE.md`](../CLAUDE.md) for the full architecture writeup.

## Commands

From the repo root (recommended, since this is an npm workspace):

```bash
npm install                    # once, from the repo root
npm run dev --workspace=web
npm run build --workspace=web
```

`predev`/`prebuild` automatically rebuild `@schedio/embed` first — see
the root `CLAUDE.md` for why that matters and what breaks if it's removed.
