"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { ConnectorFn } from "@schedio/embed";
import { combinedDemoConnector } from "@/lib/demoConnectors";

/**
 * Same shape as AppTenantProvider: which connector mode is selected is our
 * own demo-preview state, not something @schedio/embed's components know
 * or care about — they only ever see a `connector` prop (or its absence,
 * meaning "use the built-in mock"). Switching modes here is exactly what a
 * real host does by passing a different `connector` prop; nothing else
 * about GlanceView/JobDetail/PipelineGraphView changes either way.
 */
export type ConnectorMode = "single" | "combined";

interface AppConnectorContextValue {
  mode: ConnectorMode;
  setMode: (mode: ConnectorMode) => void;
  /** undefined in "single" mode — GlanceView/JobDetail default to the built-in mock connector themselves. */
  connector: ConnectorFn | undefined;
}

const AppConnectorContext = createContext<AppConnectorContextValue>({
  mode: "single",
  setMode: () => {},
  connector: undefined,
});

export function AppConnectorProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ConnectorMode>("single");
  const connector = useMemo(() => (mode === "combined" ? combinedDemoConnector : undefined), [mode]);

  return <AppConnectorContext.Provider value={{ mode, setMode, connector }}>{children}</AppConnectorContext.Provider>;
}

export function useAppConnector(): AppConnectorContextValue {
  return useContext(AppConnectorContext);
}
