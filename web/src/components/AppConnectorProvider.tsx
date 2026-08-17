"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

/**
 * Same shape as AppTenantProvider: which connector mode is selected is our
 * own demo-preview state, not something @schedio/embed's components know
 * or care about. Unlike before app/api/snapshot/route.ts existed, this
 * provider no longer builds an actual `ConnectorFn` itself — the connector
 * (single mock vs. the combined two-region mock) is now resolved
 * server-side, inside that route, from the same `mode` value read here (see
 * useScopedConnector, which sends it along as a query param). `mode` on its
 * own carries no access implications — it only picks which mock dataset to
 * use — so trusting it straight from client state is fine; the value that
 * actually matters for access, the current viewer, deliberately isn't
 * tracked here at all (see AppPermissionsProvider).
 */
export type ConnectorMode = "single" | "combined";

interface AppConnectorContextValue {
  mode: ConnectorMode;
  setMode: (mode: ConnectorMode) => void;
}

const AppConnectorContext = createContext<AppConnectorContextValue>({
  mode: "single",
  setMode: () => {},
});

export function AppConnectorProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ConnectorMode>("single");
  return <AppConnectorContext.Provider value={{ mode, setMode }}>{children}</AppConnectorContext.Provider>;
}

export function useAppConnector(): AppConnectorContextValue {
  return useContext(AppConnectorContext);
}
