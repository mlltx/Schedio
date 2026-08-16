"use client";

import { useEffect, useState } from "react";

/**
 * `getGlanceView`/`getJobDetail` are async (a real connector fetches over
 * the network), so both GlanceView and JobDetail need the same "run this,
 * keep the latest result, ignore stale responses" plumbing. The `cancelled`
 * flag matters here specifically: switching scope/time-window/connector
 * quickly can fire a new request before an older one resolves, and without
 * it a slow first response could overwrite a newer one — the effect
 * cleanup always runs before the next effect fires on a deps change, so
 * this one flag covers both that race and the unmount case.
 *
 * `pollIntervalMs` (0 = off, the default) re-runs `factory` on that
 * cadence for as long as the component stays mounted with the same deps —
 * see `resolvePollIntervalMs`, which is what every top-level component
 * actually calls this with. Polling pauses while the tab isn't visible
 * (Page Visibility API), so a connector's real API isn't hit on a cadence
 * for a tab nobody's looking at, and catches up with an immediate refetch
 * the moment the tab becomes visible again rather than waiting out
 * whatever's left of the current interval.
 */
export function usePromise<T>(factory: () => Promise<T>, deps: unknown[], pollIntervalMs = 0): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = async () => {
      const result = await factory();
      if (!cancelled) setValue(result);
    };

    const scheduleNext = () => {
      if (cancelled || !pollIntervalMs) return;
      timer = setTimeout(handleTick, pollIntervalMs);
    };

    const handleTick = async () => {
      if (document.visibilityState === "hidden") {
        scheduleNext();
        return;
      }
      await run();
      scheduleNext();
    };

    const handleVisibilityChange = () => {
      if (!pollIntervalMs || document.visibilityState !== "visible") return;
      if (timer) clearTimeout(timer);
      run().then(scheduleNext);
    };

    run().then(scheduleNext);
    if (pollIntervalMs) document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (pollIntervalMs) document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps are caller-supplied
  }, [...deps, pollIntervalMs]);

  return value;
}
