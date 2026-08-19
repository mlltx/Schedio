"use client";

import { useEffect, useState } from "react";

/**
 * `"system"` (the default) follows the OS/browser preference, same as
 * before this existed. `"light"`/`"dark"` force it regardless — the
 * escape hatch a host with their own theme toggle needs, since a host
 * setting a `.dark` class on their own page has no way to reach into
 * `prefers-color-scheme`-only styling otherwise.
 */
export type ColorScheme = "light" | "dark" | "system";

/**
 * Resolves `colorScheme` to a concrete `"light" | "dark"` — reads the OS
 * preference (and stays in sync with it live) only when `colorScheme` is
 * `"system"`.
 *
 * `systemDark` deliberately always *starts* `false`, never read from
 * `matchMedia` synchronously in the initializer, even though `window` is
 * available by the time this runs on the client. A component rendered
 * server-side has no OS preference to read at all, so it renders "light";
 * if the client's very first (hydration) render computed the real answer
 * immediately, that hydration pass would already carry the correct class —
 * but React only diffs and *reports* a hydration mismatch on that
 * attribute, it doesn't correct it. The effect below would then be
 * "correcting" state that already matches, calling `setSystemDark` with
 * the same value as a no-op that never re-renders, and the wrong class
 * would stick forever. Starting `false` guarantees the first client render
 * matches SSR exactly (no mismatch to begin with), so the effect's update
 * is a genuine state transition that actually re-renders and fixes the
 * class post-mount.
 */
export function useResolvedColorScheme(colorScheme: ColorScheme = "system"): "light" | "dark" {
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    if (colorScheme !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mql.matches);
    const handleChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, [colorScheme]);

  return colorScheme === "system" ? (systemDark ? "dark" : "light") : colorScheme;
}

/** The class to apply to the root and to any portaled popover — see `dark:`'s custom variant in `styles.css`, which reads exactly this. */
export function colorSchemeClassName(resolved: "light" | "dark"): "schedio-dark" | "schedio-light" {
  return resolved === "dark" ? "schedio-dark" : "schedio-light";
}
