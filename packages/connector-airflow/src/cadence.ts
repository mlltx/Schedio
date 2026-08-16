import type { Schedule } from "@schedio/embed";

/**
 * Airflow DAGs can run on an arbitrary cron expression; Schedio's model
 * supports five fixed cadences (see MISSION.md: the model isn't shaped
 * around any one backend's internals). This maps the common, recognizable
 * patterns exactly and falls back to the closest supported cadence for
 * anything unusual — see the README's "Known limitations" for what that
 * means in practice (a DAG on a genuinely unusual custom schedule will
 * read as daily, which is an approximation, not a crash or a silent drop).
 */

const CRON_ALIASES: Record<string, Schedule> = {
  "@hourly": { cadence: "hourly" },
  "@daily": { cadence: "daily", hour: 0, minute: 0 },
  "@midnight": { cadence: "daily", hour: 0, minute: 0 },
  "@weekly": { cadence: "weekly", weekday: 0, hour: 0, minute: 0 },
  "@monthly": { cadence: "monthly", dayOfMonth: 1, hour: 0, minute: 0 },
};

const FALLBACK: Schedule = { cadence: "daily", hour: 0, minute: 0 };

export function mapTimetableToSchedule(timetableSummary: string | null | undefined): Schedule {
  const raw = (timetableSummary ?? "").trim();
  if (!raw || raw.toLowerCase() === "none") return FALLBACK;
  if (raw in CRON_ALIASES) return CRON_ALIASES[raw];

  const parts = raw.split(/\s+/);
  if (parts.length !== 5) return FALLBACK;
  const [minute, hour, dayOfMonth, , weekday] = parts;
  const isNum = (s: string) => /^\d+$/.test(s);

  if (isNum(minute) && hour === "*" && dayOfMonth === "*" && weekday === "*") {
    return { cadence: "hourly" };
  }
  if (hour.startsWith("*/") && dayOfMonth === "*" && weekday === "*") {
    // Any exact N-hour divisor (e.g. */4, */6, */12) collapses onto the
    // one "every N hours" cadence Schedio supports.
    return { cadence: "every_6_hours" };
  }
  if (isNum(minute) && isNum(hour) && dayOfMonth === "*" && weekday === "*") {
    return { cadence: "daily", hour: Number(hour), minute: Number(minute) };
  }
  if (isNum(minute) && isNum(hour) && dayOfMonth === "*" && isNum(weekday)) {
    return { cadence: "weekly", weekday: Number(weekday), hour: Number(hour), minute: Number(minute) };
  }
  if (isNum(minute) && isNum(hour) && isNum(dayOfMonth)) {
    return { cadence: "monthly", dayOfMonth: Number(dayOfMonth), hour: Number(hour), minute: Number(minute) };
  }

  // Multi-value fields (e.g. "0 6,18 * * *"), step values on minutes, or
  // anything else this heuristic doesn't recognize — approximate rather
  // than guess wrong.
  return FALLBACK;
}
