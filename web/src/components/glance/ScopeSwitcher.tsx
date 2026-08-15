import type { HeadlineKind, Scope } from "@/model";
import { HEADLINE_VISUAL } from "./visuals";

export function ScopeSwitcher({
  scopes,
  headlineByScope,
  selectedScopeId,
  onSelect,
}: {
  scopes: Scope[];
  headlineByScope: Record<string, HeadlineKind>;
  selectedScopeId: string;
  onSelect: (scopeId: string) => void;
}) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
      {scopes.map((scope) => {
        const isSelected = scope.id === selectedScopeId;
        const kind = headlineByScope[scope.id];
        const visual = kind ? HEADLINE_VISUAL[kind] : undefined;
        return (
          <button
            key={scope.id}
            type="button"
            onClick={() => onSelect(scope.id)}
            aria-pressed={isSelected}
            style={isSelected ? { backgroundColor: "var(--brand-primary)", borderColor: "var(--brand-primary)", color: "var(--brand-primary-foreground)" } : undefined}
            className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
              isSelected
                ? ""
                : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-zinc-700"
            }`}
          >
            {visual && scope.id !== "all" && (
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${isSelected ? "bg-current" : visual.dot}`} />
            )}
            {scope.name}
          </button>
        );
      })}
    </div>
  );
}
