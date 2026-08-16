import { test } from "node:test";
import assert from "node:assert/strict";
import { mapTimetableToSchedule } from "../cadence";

test("recognizes cron aliases", () => {
  assert.deepEqual(mapTimetableToSchedule("@hourly"), { cadence: "hourly" });
  assert.deepEqual(mapTimetableToSchedule("@daily"), { cadence: "daily", hour: 0, minute: 0 });
  assert.deepEqual(mapTimetableToSchedule("@weekly"), { cadence: "weekly", weekday: 0, hour: 0, minute: 0 });
  assert.deepEqual(mapTimetableToSchedule("@monthly"), { cadence: "monthly", dayOfMonth: 1, hour: 0, minute: 0 });
});

test("maps a fixed daily cron expression", () => {
  assert.deepEqual(mapTimetableToSchedule("0 6 * * *"), { cadence: "daily", hour: 6, minute: 0 });
  assert.deepEqual(mapTimetableToSchedule("30 14 * * *"), { cadence: "daily", hour: 14, minute: 30 });
});

test("maps hourly-at-a-fixed-minute", () => {
  assert.deepEqual(mapTimetableToSchedule("15 * * * *"), { cadence: "hourly" });
});

test("collapses an N-hour step to every_6_hours", () => {
  assert.deepEqual(mapTimetableToSchedule("0 */4 * * *"), { cadence: "every_6_hours" });
  assert.deepEqual(mapTimetableToSchedule("0 */6 * * *"), { cadence: "every_6_hours" });
});

test("maps a fixed weekday cron expression", () => {
  assert.deepEqual(mapTimetableToSchedule("0 7 * * 1"), { cadence: "weekly", weekday: 1, hour: 7, minute: 0 });
});

test("maps a fixed day-of-month cron expression", () => {
  assert.deepEqual(mapTimetableToSchedule("0 6 15 * *"), { cadence: "monthly", dayOfMonth: 15, hour: 6, minute: 0 });
});

test("falls back to daily for None (manually-triggered DAGs)", () => {
  assert.deepEqual(mapTimetableToSchedule("None"), { cadence: "daily", hour: 0, minute: 0 });
  assert.deepEqual(mapTimetableToSchedule(null), { cadence: "daily", hour: 0, minute: 0 });
  assert.deepEqual(mapTimetableToSchedule(undefined), { cadence: "daily", hour: 0, minute: 0 });
});

test("falls back to daily for an unrecognized custom schedule rather than guessing", () => {
  // A minute-step cron ("every 17 minutes") has no honest equivalent among
  // Schedio's five fixed cadences.
  assert.deepEqual(mapTimetableToSchedule("*/17 * * * *"), { cadence: "daily", hour: 0, minute: 0 });
  // Multi-value hour field.
  assert.deepEqual(mapTimetableToSchedule("0 6,18 * * *"), { cadence: "daily", hour: 0, minute: 0 });
});
