"use client";

import { TENANT_PRESETS } from "@/config/presets";
import { useSetTenantId, useTenantConfig } from "@/config/TenantConfigProvider";

/**
 * A real deployment ships with one tenant config baked in — this switcher
 * only exists here to prove, live, that swapping brand and terminology
 * really is a config change and not a find-and-replace across components.
 * Same spirit as the connector-outage demo control.
 */
export function TenantSwitcher() {
  const config = useTenantConfig();
  const setTenantId = useSetTenantId();

  return (
    <label className="flex shrink-0 items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500">
      <span className="hidden sm:inline">Preview as</span>
      <select
        value={config.id}
        onChange={(e) => setTenantId(e.target.value)}
        className="rounded-md border border-zinc-200 bg-white px-1.5 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
        aria-label="Preview a different tenant's branding and terminology"
      >
        {TENANT_PRESETS.map((tenant) => (
          <option key={tenant.id} value={tenant.id}>
            {tenant.brand.productName}
          </option>
        ))}
      </select>
    </label>
  );
}
