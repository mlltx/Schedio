"use client";

import { createContext, useContext, useMemo, type ReactNode, type CSSProperties } from "react";
import type { TenantConfig } from "./types";
import { DEFAULT_TENANT_CONFIG } from "./presets";

/**
 * Wraps whatever renders `GlanceView`/`JobDetail`. In a host app, that's
 * once, near the root, with the host's own `config` — to change tenant,
 * the host just re-renders with a different `config` object, the same way
 * any other React context works. There's no internal "selected preset"
 * state here on purpose: picking between presets is a demo-app concern
 * (see web/'s own tenant switcher), not something the package itself
 * needs to know how to do.
 */
const TenantConfigContext = createContext<TenantConfig>(DEFAULT_TENANT_CONFIG);

export function TenantConfigProvider({
  config = DEFAULT_TENANT_CONFIG,
  children,
}: {
  config?: TenantConfig;
  children: ReactNode;
}) {
  const style = useMemo(
    () =>
      ({
        // Namespaced (not just "--brand-primary") so a host already using
        // that name for their own theming doesn't silently leak into ours,
        // or vice versa.
        "--schedio-brand-primary": config.brand.colors.primary,
        "--schedio-brand-primary-foreground": config.brand.colors.primaryForeground,
        // Inline, not a Tailwind `contents` class: this div sits *outside*
        // .schedio-embed-root (it wraps whatever renders it, GlanceView
        // included), so a class scoped to apply only inside that wrapper
        // would never match here — it only ever worked in web/'s own demo
        // because that app happens to run its own separate, unscoped
        // Tailwind build too.
        display: "contents",
      }) as CSSProperties,
    [config.brand.colors.primary, config.brand.colors.primaryForeground],
  );

  return (
    <TenantConfigContext.Provider value={config}>
      <div style={style}>{children}</div>
    </TenantConfigContext.Provider>
  );
}

export function useTenantConfig(): TenantConfig {
  return useContext(TenantConfigContext);
}
