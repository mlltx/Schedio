"use client";

import { useMemo, useState } from "react";
import { getScopes, getGlanceView, type ScopeStatus, type TimeWindow } from "@/model";
import { HeadlineBanner } from "./HeadlineBanner";
import { ScopeSwitcher } from "./ScopeSwitcher";
import { TimeWindowPicker } from "./TimeWindowPicker";
import { ExceptionList } from "./ExceptionList";
import { DemoControls } from "./DemoControls";

const scopes = getScopes();
const teamScopes = scopes.filter((s) => s.kind === "team");

export function GlanceView() {
  const [selectedScopeId, setSelectedScopeId] = useState("all");
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("since_midnight");
  const [reachabilityOverrides, setReachabilityOverrides] = useState<Record<string, boolean>>({});

  // Every scope's status is cheap to compute, and the switcher needs all of
  // them at once (to show a status dot per scope) — so compute the whole
  // set together and let the selected view be a lookup into it.
  const scopeStatuses = useMemo(() => {
    const map: Record<string, ScopeStatus> = {};
    for (const scope of scopes) {
      map[scope.id] = getGlanceView(scope.id, timeWindow, { reachabilityOverrides });
    }
    return map;
  }, [timeWindow, reachabilityOverrides]);

  const view = scopeStatuses[selectedScopeId];

  const headlineByScope = useMemo(() => {
    return Object.fromEntries(Object.entries(scopeStatuses).map(([id, s]) => [id, s.headline]));
  }, [scopeStatuses]);

  const reachableByScope = useMemo(() => {
    return Object.fromEntries(teamScopes.map((s) => [s.id, scopeStatuses[s.id]?.connectorReachable ?? true]));
  }, [scopeStatuses]);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-6 flex items-center justify-between gap-4">
        <span className="text-sm font-semibold tracking-widest text-zinc-400 uppercase dark:text-zinc-500">
          Schedio
        </span>
        <TimeWindowPicker value={timeWindow} onChange={setTimeWindow} />
      </div>

      <ScopeSwitcher
        scopes={scopes}
        headlineByScope={headlineByScope}
        selectedScopeId={selectedScopeId}
        onSelect={setSelectedScopeId}
      />

      <div className="mt-6">
        <HeadlineBanner view={view} />
      </div>

      <ExceptionList exceptions={view.exceptions} onOutageClick={setSelectedScopeId} />

      <DemoControls
        teamScopes={teamScopes}
        reachableByScope={reachableByScope}
        onToggle={(scopeId, reachable) =>
          setReachabilityOverrides((prev) => ({ ...prev, [scopeId]: reachable }))
        }
      />
    </div>
  );
}
