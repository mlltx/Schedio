"use client";

import { useAppConnector, type ConnectorMode } from "./AppConnectorProvider";

/**
 * Demo-only, same reasoning as TenantSwitcherBar: a real host has exactly
 * one connector setup (or one `combineConnectors` call, decided in code,
 * not toggled at runtime by a visitor) — this exists purely to make
 * "several connectors, one view" visible without a live Airflow instance.
 */
export function ConnectorModeSwitcher() {
  const { mode, setMode } = useAppConnector();

  return (
    <label className="flex shrink-0 items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500">
      <span className="hidden sm:inline">Data source</span>
      <select
        value={mode}
        onChange={(e) => setMode(e.target.value as ConnectorMode)}
        className="rounded-md border border-zinc-200 bg-white px-1.5 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
        aria-label="Preview a single connector vs. several connectors combined"
      >
        <option value="single">Single connector</option>
        <option value="combined">Combined (2 instances)</option>
      </select>
    </label>
  );
}
