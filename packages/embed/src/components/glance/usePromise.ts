"use client";

import { useEffect, useRef, useState } from "react";

/**
 * `getGlanceView`/`getJobDetail` are async (a real connector fetches over
 * the network), so both GlanceView and JobDetail need the same "run this,
 * keep the latest result, ignore stale responses" plumbing. The ref guard
 * matters here specifically: switching scope/time-window/connector quickly
 * can fire a new request before an older one resolves, and without it a
 * slow first response could overwrite a newer one.
 */
export function usePromise<T>(factory: () => Promise<T>, deps: unknown[]): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);
  const requestId = useRef(0);

  useEffect(() => {
    const id = ++requestId.current;
    let cancelled = false;
    factory().then((result) => {
      if (!cancelled && requestId.current === id) setValue(result);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps are caller-supplied
  }, deps);

  return value;
}
