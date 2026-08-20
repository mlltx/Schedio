"use client";

import { useTenantConfig } from "@schedio/embed";

/**
 * @schedio/embed's own views don't render a product-name header — a host
 * embedding them already has their own page chrome, and repeating the
 * product name inside the widget would be exactly the kind of thing that
 * makes an embed feel like a foreign iframe rather than part of the page
 * it's dropped into (see MISSION.md's embeddability principle). web/ is
 * the one case where Schedio *is* the whole page, so this is our own
 * chrome around the component, not something GlanceView provides — same
 * `useTenantConfig()` the component itself reads, just rendered a layer
 * up.
 */
export function AppHeader() {
  const tenant = useTenantConfig();
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-8 sm:px-6 sm:pt-12">
      <span className="truncate text-sm font-semibold tracking-widest text-zinc-400 uppercase dark:text-zinc-500">
        {tenant.brand.productName}
      </span>
    </div>
  );
}
