"use client";

import { useMemo, useState } from "react";
import { getScopes, getGlanceView, type ConnectorFn, type ScopeStatus, type TimeWindow } from "@/model";
import { useTenantConfig } from "@/config/TenantConfigProvider";
import { HeadlineBanner } from "./HeadlineBanner";
import { ScopeSwitcher } from "./ScopeSwitcher";
import { TimeWindowPicker } from "./TimeWindowPicker";
import { ExceptionList } from "./ExceptionList";
import { DemoControls } from "./DemoControls";
import { usePromise } from "./usePromise";
import type { JobNavigation } from "./navigation";

const scopes = getScopes();
const teamScopes = scopes.filter((s) => s.kind === "team");

export interface GlanceViewProps extends JobNavigation {
  /** Where the data comes from. Defaults to Schedio's built-in mock connector. */
  connector?: ConnectorFn;
  /**
   * Shows the connector-outage simulator. Defaults to true only when using
   * the built-in mock connector (a real connector generally doesn't know
   * what to do with a client-side "pretend you're unreachable" override,
   * so this doesn't default on for a real integration).
   */
  showDemoControls?: boolean;
}

export function GlanceView({ connector, showDemoControls, getJobHref, onJobSelect }: GlanceViewProps) {
  const tenant = useTenantConfig();
  const [selectedScopeId, setSelectedScopeId] = useState("all");
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("since_midnight");
  const [reachabilityOverrides, setReachabilityOverrides] = useState<Record<string, boolean>>({});

  // Every scope's status is cheap to compute, and the switcher needs all of
  // them at once (to show a status dot per scope) — so fetch the whole set
  // together and let the selected view be a lookup into it.
  const scopeStatuses = usePromise(async () => {
    const entries = await Promise.all(
      scopes.map(async (scope) => {
        const view = await getGlanceView(scope.id, timeWindow, {
          reachabilityOverrides,
          terms: tenant.terminology,
          connector,
        });
        return [scope.id, view] as const;
      }),
    );
    return Object.fromEntries(entries) as Record<string, ScopeStatus>;
  }, [timeWindow, reachabilityOverrides, tenant.terminology, connector]);

  const headlineByScope = useMemo(() => {
    if (!scopeStatuses) return {};
    return Object.fromEntries(Object.entries(scopeStatuses).map(([id, s]) => [id, s.headline]));
  }, [scopeStatuses]);

  const reachableByScope = useMemo(() => {
    if (!scopeStatuses) return {};
    return Object.fromEntries(teamScopes.map((s) => [s.id, scopeStatuses[s.id]?.connectorReachable ?? true]));
  }, [scopeStatuses]);

  const view = scopeStatuses?.[selectedScopeId];
  const demoControlsVisible = showDemoControls ?? connector === undefined;

  return (
    <div className="schedio-embed-root mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="truncate text-sm font-semibold tracking-widest text-zinc-400 uppercase dark:text-zinc-500">
          {tenant.brand.productName}
        </span>
      </div>

      <div className="mb-6 overflow-x-auto">
        <TimeWindowPicker value={timeWindow} onChange={setTimeWindow} />
      </div>

      <ScopeSwitcher
        scopes={scopes}
        headlineByScope={headlineByScope}
        selectedScopeId={selectedScopeId}
        onSelect={setSelectedScopeId}
      />

      {!view ? (
        <div className="mt-6 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-100 px-6 py-10 dark:border-zinc-800 dark:bg-zinc-900" />
      ) : (
        <>
          <div className="mt-6">
            <HeadlineBanner view={view} />
          </div>

          <ExceptionList
            exceptions={view.exceptions}
            heading={tenant.copy.exceptionsHeading}
            onOutageClick={setSelectedScopeId}
            getJobHref={getJobHref}
            onJobSelect={onJobSelect}
          />
        </>
      )}

      {demoControlsVisible && (
        <DemoControls
          teamScopes={teamScopes}
          reachableByScope={reachableByScope}
          onToggle={(scopeId, reachable) =>
            setReachabilityOverrides((prev) => ({ ...prev, [scopeId]: reachable }))
          }
        />
      )}
    </div>
  );
}
