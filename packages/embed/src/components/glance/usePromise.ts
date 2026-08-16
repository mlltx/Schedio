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
 */
export function usePromise<T>(factory: () => Promise<T>, deps: unknown[]): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    factory().then((result) => {
      if (!cancelled) setValue(result);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps are caller-supplied
  }, deps);

  return value;
}
