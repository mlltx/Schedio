"use client";

import { forwardRef, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { getAllScopeStatuses, mockConnector, resolvePollIntervalMs, type ConnectorFn, type TimeWindow } from "../../model";
import { useTenantConfig } from "../../config/TenantConfigProvider";
import { HeadlineBanner } from "./HeadlineBanner";
import { ScopeSwitcher } from "./ScopeSwitcher";
import { TimeWindowPicker } from "./TimeWindowPicker";
import { ExceptionList } from "./ExceptionList";
import { DemoControls } from "./DemoControls";
import { SourceStatusStrip } from "./SourceStatusStrip";
import { usePromise } from "./usePromise";
import { cx } from "./cx";
import type { JobNavigation } from "./navigation";
import type { HeadingLevel } from "./Heading";
import { useResolvedColorScheme, colorSchemeClassName, type ColorScheme } from "./colorScheme";

const defaultLoading = () => (
  <div className="mt-6 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-100 px-6 py-10 dark:border-zinc-800 dark:bg-zinc-900" />
);

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
  /** Replaces the default skeleton shown while the first fetch is in flight. */
  renderLoading?: () => ReactNode;
  /**
   * Heading level for the "All needs attention"-style banner headline —
   * the most prominent text in this view. Defaults to `1`; set it to
   * match wherever this sits in the host page's own document outline
   * (e.g. `2` if the host's page already has its own `<h1>`).
   */
  headingLevel?: HeadingLevel;
  /**
   * `"system"` (the default) follows the OS/browser preference. Set to
   * `"light"`/`"dark"` to defer to a host's own theme toggle instead —
   * see `components/glance/colorScheme.ts`.
   */
  colorScheme?: ColorScheme;
  /**
   * Caps the root element's width, same value shape as CSS `max-width`
   * (`"56rem"`, `"100%"`, `640`, ...). Defaults to `"42rem"`. Applied as an
   * inline style rather than a Tailwind class specifically so it's
   * guaranteed to win — a `max-w-*` class on `className` has the exact
   * same specificity as this component's own default `max-w-2xl` and
   * would only override it by accident of stylesheet order, which a host
   * can't rely on. Use this instead of fighting `className` for layout.
   */
  maxWidth?: string | number;
  /** Merged onto the root element — the standard escape hatch for one-off layout nudges; not for structural overrides like width (see `maxWidth`). */
  className?: string;
  style?: CSSProperties;
}

export const GlanceView = forwardRef<HTMLDivElement, GlanceViewProps>(function GlanceView(
  {
    connector,
    showDemoControls,
    renderLoading = defaultLoading,
    headingLevel,
    colorScheme,
    maxWidth = "42rem",
    className,
    style,
    getJobHref,
    onJobSelect,
  },
  ref,
) {
  const tenant = useTenantConfig();
  const resolvedColorScheme = useResolvedColorScheme(colorScheme);
  const [selectedScopeId, setSelectedScopeId] = useState("all");
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("since_midnight");
  const [reachabilityOverrides, setReachabilityOverrides] = useState<Record<string, boolean>>({});

  // The switcher needs every scope's status at once (to show a status dot
  // per scope) — getAllScopeStatuses fetches the connector snapshot and
  // classifies every job exactly once and rolls up all scopes from that,
  // rather than repeating the fetch+classify work once per scope. Scopes
  // themselves are connector-reported now (not a static list), so they
  // come from this same fetch too — a switcher tab can't exist before the
  // first fetch resolves, the same way a scope's status can't.
  const data = usePromise(
    () => getAllScopeStatuses(timeWindow, { reachabilityOverrides, terms: tenant.terminology, connector }),
    [timeWindow, reachabilityOverrides, tenant.terminology, connector],
    resolvePollIntervalMs(connector ?? mockConnector),
  );

  const teamScopes = useMemo(() => data?.scopes.filter((s) => s.kind === "team") ?? [], [data]);

  const headlineByScope = useMemo(() => {
    if (!data) return {};
    return Object.fromEntries(Object.entries(data.statuses).map(([id, s]) => [id, s.headline]));
  }, [data]);

  const reachableByScope = useMemo(() => {
    if (!data) return {};
    return Object.fromEntries(teamScopes.map((s) => [s.id, data.statuses[s.id]?.connectorReachable ?? true]));
  }, [data, teamScopes]);

  const view = data?.statuses[selectedScopeId];
  const demoControlsVisible = showDemoControls ?? connector === undefined;

  return (
    <div
      ref={ref}
      style={{ maxWidth, ...style }}
      className={cx(
        "schedio-embed-root mx-auto w-full px-4 py-8 sm:px-6 sm:py-12",
        colorSchemeClassName(resolvedColorScheme),
        className,
      )}
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="overflow-x-auto">
          <TimeWindowPicker value={timeWindow} onChange={setTimeWindow} />
        </div>
        {data?.sources && data.sources.length > 0 && <SourceStatusStrip sources={data.sources} />}
      </div>

      {!data ? (
        renderLoading()
      ) : (
        <>
          <ScopeSwitcher
            scopes={data.scopes}
            headlineByScope={headlineByScope}
            selectedScopeId={selectedScopeId}
            onSelect={setSelectedScopeId}
            colorSchemeClassName={colorSchemeClassName(resolvedColorScheme)}
          />

          {view && (
            <>
              <div className="mt-6">
                <HeadlineBanner view={view} headingLevel={headingLevel} />
              </div>

              <ExceptionList
                exceptions={view.exceptions}
                heading={tenant.copy.exceptionsHeading}
                terms={tenant.terminology}
                onOutageClick={setSelectedScopeId}
                getJobHref={getJobHref}
                onJobSelect={onJobSelect}
              />
            </>
          )}
        </>
      )}

      {demoControlsVisible && data && (
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
});
