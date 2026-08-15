"use client";

import { createContext, useContext, useMemo, useState, type ReactNode, type CSSProperties } from "react";
import type { TenantConfig } from "./types";
import { DEFAULT_TENANT_CONFIG, TENANT_PRESETS } from "./presets";

/**
 * Lives in the root layout, wrapping the whole app. Because Next's App
 * Router keeps a layout's React tree mounted across client-side
 * navigations, the selected tenant (and its context) survives navigating
 * from the glance view into a job detail page with zero extra plumbing —
 * the same reason client component state anywhere else in this app
 * survives route changes.
 */
interface TenantConfigContextValue {
  config: TenantConfig;
  setTenantId: (id: string) => void;
}

const TenantConfigContext = createContext<TenantConfigContextValue>({
  config: DEFAULT_TENANT_CONFIG,
  setTenantId: () => {},
});

export function TenantConfigProvider({ children }: { children: ReactNode }) {
  const [tenantId, setTenantId] = useState(DEFAULT_TENANT_CONFIG.id);
  const config = useMemo(
    () => TENANT_PRESETS.find((t) => t.id === tenantId) ?? DEFAULT_TENANT_CONFIG,
    [tenantId],
  );
  const value = useMemo(() => ({ config, setTenantId }), [config]);

  return (
    <TenantConfigContext.Provider value={value}>
      <div
        style={
          {
            "--brand-primary": config.brand.colors.primary,
            "--brand-primary-foreground": config.brand.colors.primaryForeground,
          } as CSSProperties
        }
        className="contents"
      >
        {children}
      </div>
    </TenantConfigContext.Provider>
  );
}

export function useTenantConfig(): TenantConfig {
  return useContext(TenantConfigContext).config;
}

export function useSetTenantId(): (id: string) => void {
  return useContext(TenantConfigContext).setTenantId;
}
