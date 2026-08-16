"use client";

import type { TenantConfig } from "@/config/types";

/**
 * Fully controlled — this component has no opinion about *where* the list
 * of tenants comes from or how selection state is stored, because "let
 * people preview several brand configs" is a demo-app concern, not
 * something `GlanceView` itself does. web/'s app is the one real consumer
 * of this; a host embedding Schedio with their own single tenant has no
 * reason to render it at all.
 */
export function TenantSwitcher({
  tenants,
  selectedId,
  onSelect,
}: {
  tenants: TenantConfig[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <label className="flex shrink-0 items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500">
      <span className="hidden sm:inline">Preview as</span>
      <select
        value={selectedId}
        onChange={(e) => onSelect(e.target.value)}
        className="rounded-md border border-zinc-200 bg-white px-1.5 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
        aria-label="Preview a different tenant's branding and terminology"
      >
        {tenants.map((tenant) => (
          <option key={tenant.id} value={tenant.id}>
            {tenant.brand.productName}
          </option>
        ))}
      </select>
    </label>
  );
}
