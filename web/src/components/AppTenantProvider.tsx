"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { TenantConfigProvider, DEFAULT_TENANT_CONFIG, TENANT_PRESETS } from "@schedio/embed";

/**
 * @schedio/embed's own TenantConfigProvider is deliberately dumb — it just
 * renders whatever `config` object it's given, because a real host has
 * exactly one tenant and has no reason to switch it at runtime. Letting
 * *this* app's visitors preview all three presets live is our own demo
 * feature, so the "which preset is selected" state lives here, in web/,
 * not in the package.
 */
interface AppTenantContextValue {
  id: string;
  setId: (id: string) => void;
}

const AppTenantContext = createContext<AppTenantContextValue>({
  id: DEFAULT_TENANT_CONFIG.id,
  setId: () => {},
});

export function AppTenantProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState(DEFAULT_TENANT_CONFIG.id);
  const config = TENANT_PRESETS.find((t) => t.id === id) ?? DEFAULT_TENANT_CONFIG;

  return (
    <AppTenantContext.Provider value={{ id, setId }}>
      <TenantConfigProvider config={config}>{children}</TenantConfigProvider>
    </AppTenantContext.Provider>
  );
}

export function useAppTenantId(): AppTenantContextValue {
  return useContext(AppTenantContext);
}
