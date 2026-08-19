import type { Scope } from "@/model";

/**
 * A real product wouldn't ship a button that unplugs its own data source —
 * this exists so the connector-outage handling in the model layer is
 * actually exercisable in the demo, not just in code. Kept behind a
 * disclosure and clearly labeled so it doesn't read as a real feature.
 */
export function DemoControls({
  teamScopes,
  reachableByScope,
  onToggle,
}: {
  teamScopes: Scope[];
  reachableByScope: Record<string, boolean>;
  onToggle: (scopeId: string, reachable: boolean) => void;
}) {
  return (
    <details className="mt-12 rounded-xl border border-zinc-200 dark:border-zinc-800">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-zinc-500 select-none dark:text-zinc-400">
        Demo controls — simulate a connector outage
      </summary>
      <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
          Flip a scope&apos;s connector off to see how a lost data source is handled — this is a stand-in for a
          real scheduler API going unreachable, not a feature of the product itself.
        </p>
        <div className="flex flex-col gap-2">
          {teamScopes.map((scope) => {
            const reachable = reachableByScope[scope.id] ?? true;
            return (
              <label key={scope.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-zinc-700 dark:text-zinc-300">{scope.name}</span>
                <span className="flex items-center gap-2">
                  <span className={reachable ? "text-zinc-400" : "text-red-600 dark:text-red-400"}>
                    {reachable ? "Connected" : "Unreachable"}
                  </span>
                  <input
                    type="checkbox"
                    checked={!reachable}
                    onChange={(e) => onToggle(scope.id, !e.target.checked)}
                    style={{ accentColor: "var(--schedio-brand-primary, #18181b)" }}
                    className="h-4 w-4"
                    aria-label={`Simulate outage for ${scope.name}`}
                  />
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </details>
  );
}
