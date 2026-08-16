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
        "--brand-primary": config.brand.colors.primary,
        "--brand-primary-foreground": config.brand.colors.primaryForeground,
      }) as CSSProperties,
    [config.brand.colors.primary, config.brand.colors.primaryForeground],
  );

  return (
    <TenantConfigContext.Provider value={config}>
      <div style={style} className="contents">
        {children}
      </div>
    </TenantConfigContext.Provider>
  );
}

export function useTenantConfig(): TenantConfig {
  return useContext(TenantConfigContext);
}
