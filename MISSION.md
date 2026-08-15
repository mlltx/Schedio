# Mission

A world-class visual model for scheduled work. Any orchestrator with an API
can plug in, but the model and the experience are ours — built so people who
don't write pipelines can still see, understand, and trust what's running and
why.

## What we're building

Scheduling tools bundle three things that don't need to be bundled: the
execution engine, the data model, and the interface. We are not building
another engine. We are building:

1. **The model** — a clean, engine-agnostic representation of jobs,
   schedules, runs, dependencies, and status.
2. **The visualization** — an interface good enough that it becomes the way
   people *want* to look at their scheduled work, regardless of what's
   actually executing it underneath.

Connectors to real schedulers (Airflow, Kubernetes, Argo, Dagster, Temporal,
Prefect, etc.) exist to feed the model. They are not the product.

## Who we're building it for

Less-technical users — ops, support, leadership, anyone who needs to answer
"what's supposed to happen, did it happen, and if not, why" without reading
DAG code or understanding task-instantiation semantics.

The UX bar is **comprehension, not density**: could someone with no
onboarding open this and understand system health in ten seconds?

## Core principles

- **The model is the product.** Design a backend-agnostic schema for job,
  schedule, run, dependency, and status — expressive enough to losslessly
  represent everything Airflow 3 can show, but not shaped like Airflow's
  internals. Design the model on its own merits, independent of any single
  connector's quirks.

- **Connectors are thin and disposable.** An adapter's job is to map a
  backend's API into the model, nothing more. If a connector has to bend the
  model to fit, the model was wrong — fix the model, not the connector.

- **The UI never talks to a scheduler directly.** Only to the model. This
  boundary is what makes "decoupled" true rather than aspirational. Don't
  leak backend-specific concepts up into the interface.

- **Airflow 3 is the functional floor, not the ceiling.** Use it as the
  baseline checklist for what must be representable (DAG/dependency views,
  run history, retries, SLAs, etc.). But every feature gets re-asked: "what
  does this look like for someone who isn't reading code?" Feature parity is
  the minimum bar, not the goal.

- **Plain language over jargon.** Status, errors, and structure should read
  in human terms. Progressive disclosure for technical detail — logs, code,
  configs are available but never front-and-center.

- **Read-first, write-second.** Nail visualization, monitoring, and trust
  before tackling triggering or editing runs through the UI. Writes, when
  they arrive, get proxied back to the native engine through the same model
  boundary — never bypass it.

- **Migration mode is first-class.** Being able to show the same logical
  schedule as it exists in two different backends, side by side, is a core
  use case (de-risking cutovers) — not a nice-to-have.

## Guardrail question for every feature/design decision

> Does this belong in the model, or is it leaking a specific backend's shape
> into our product? And would a non-engineer understand it without help?

If a proposed feature only makes sense in terms of one scheduler's internals,
or only makes sense to someone who already knows how schedulers work, it
needs to be reshaped before it goes in.
