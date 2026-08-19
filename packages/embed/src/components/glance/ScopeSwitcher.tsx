"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import type { HeadlineKind, Scope } from "@/model";
import { HEADLINE_VISUAL } from "./visuals";
import { cx } from "./cx";

/**
 * "All" stays a single always-visible pill — it's one fixed element
 * regardless of how many teams exist, and it's almost always where a
 * viewer starts. Every team scope lives behind one bounded picker instead
 * of a pill each, so this row takes the same footprint whether there are
 * 3 teams or 300: a real deployment combining several Airflow instances
 * (see `combineConnectors`) can easily have far more scopes than fit on
 * screen as pills, and a list that keeps growing taller as more instances
 * get combined is exactly the kind of "does this still work at scale"
 * problem this component exists to not have.
 */
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
  const allScope = scopes.find((s) => s.kind === "all");
  const teamScopes = useMemo(() => scopes.filter((s) => s.kind === "team"), [scopes]);
  const selectedTeamScope = teamScopes.find((s) => s.id === selectedScopeId);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {allScope && (
        <ScopePill
          name={allScope.name}
          isSelected={selectedScopeId === allScope.id}
          onClick={() => onSelect(allScope.id)}
        />
      )}
      {teamScopes.length > 0 && (
        <TeamScopePicker
          teamScopes={teamScopes}
          headlineByScope={headlineByScope}
          selected={selectedTeamScope}
          selectedScopeId={selectedScopeId}
          onSelect={onSelect}
        />
      )}
    </div>
  );
}

function ScopePill({ name, dotClassName, isSelected, onClick }: { name: string; dotClassName?: string; isSelected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSelected}
      style={
        isSelected
          ? { backgroundColor: "var(--brand-primary)", borderColor: "var(--brand-primary)", color: "var(--brand-primary-foreground)" }
          : undefined
      }
      className={cx(
        "flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
        !isSelected &&
          "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-zinc-700",
      )}
    >
      {dotClassName && <span className={cx("h-1.5 w-1.5 shrink-0 rounded-full", isSelected ? "bg-current" : dotClassName)} />}
      {name}
    </button>
  );
}

function TeamScopePicker({
  teamScopes,
  headlineByScope,
  selected,
  selectedScopeId,
  onSelect,
}: {
  teamScopes: Scope[];
  headlineByScope: Record<string, HeadlineKind>;
  selected: Scope | undefined;
  selectedScopeId: string;
  onSelect: (scopeId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else setQuery("");
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return teamScopes;
    return teamScopes.filter((s) => s.name.toLowerCase().includes(q));
  }, [teamScopes, query]);

  const selectedVisual = selected ? HEADLINE_VISUAL[headlineByScope[selected.id]] : undefined;

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={
          selected
            ? { backgroundColor: "var(--brand-primary)", borderColor: "var(--brand-primary)", color: "var(--brand-primary-foreground)" }
            : undefined
        }
        className={cx(
          "flex max-w-[13rem] items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
          !selected &&
            "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-zinc-700",
        )}
      >
        {selected && selectedVisual && (
          <span className={cx("h-1.5 w-1.5 shrink-0 rounded-full", selected ? "bg-current" : selectedVisual.dot)} />
        )}
        <span className="truncate">{selected ? selected.name : `Teams (${teamScopes.length})`}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-10 mt-2 w-72 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2 dark:border-zinc-900">
            <Search className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Find a team (${teamScopes.length})...`}
              className="w-full bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100"
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-zinc-400">No teams match &ldquo;{query}&rdquo;</p>
            ) : (
              filtered.map((scope) => {
                const isSelected = scope.id === selectedScopeId;
                const visual = HEADLINE_VISUAL[headlineByScope[scope.id]];
                return (
                  <button
                    key={scope.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onSelect(scope.id);
                      setOpen(false);
                    }}
                    className={cx(
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                      isSelected ? "bg-zinc-100 dark:bg-zinc-900" : "hover:bg-zinc-50 dark:hover:bg-zinc-900/60",
                    )}
                  >
                    {visual && <span className={cx("h-1.5 w-1.5 shrink-0 rounded-full", visual.dot)} />}
                    <span className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-300">{scope.name}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-zinc-500 dark:text-zinc-400" aria-hidden />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
