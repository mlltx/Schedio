"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { CheckIcon, ChevronDownIcon, SearchIcon } from "./icons";
import type { HeadlineKind, Scope } from "../../model";
import { useTenantConfig } from "../../config/TenantConfigProvider";
import { HEADLINE_VISUAL } from "./visuals";
import { cx } from "./cx";
import { computePopoverPosition, type PopoverPosition } from "./popoverPosition";

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
  colorSchemeClassName,
}: {
  scopes: Scope[];
  headlineByScope: Record<string, HeadlineKind>;
  selectedScopeId: string;
  onSelect: (scopeId: string) => void;
  /** Reapplied on the portaled popover, which escapes the normal DOM class-inheritance chain — see `colorScheme.ts`. */
  colorSchemeClassName?: string;
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
          colorSchemeClassName={colorSchemeClassName}
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
          ? {
              backgroundColor: "var(--schedio-brand-primary, #18181b)",
              borderColor: "var(--schedio-brand-primary, #18181b)",
              color: "var(--schedio-brand-primary-foreground, #ffffff)",
            }
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

/** Where the popover renders relative to the viewport — recomputed on open, on scroll, and on resize (see the layout effect below). */
function TeamScopePicker({
  teamScopes,
  headlineByScope,
  selected,
  selectedScopeId,
  onSelect,
  colorSchemeClassName,
}: {
  teamScopes: Scope[];
  headlineByScope: Record<string, HeadlineKind>;
  selected: Scope | undefined;
  selectedScopeId: string;
  onSelect: (scopeId: string) => void;
  colorSchemeClassName?: string;
}) {
  const tenant = useTenantConfig();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  // The popover portals to document.body (see the render below for why),
  // so it's no longer a DOM descendant of the trigger — click-outside
  // detection needs a ref into *both* subtrees now.
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  // Portals can only render after mount (no `document` at SSR time), and
  // reading document.body up front rather than inside the portal call
  // keeps that guard in one obvious place.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return teamScopes;
    return teamScopes.filter((s) => s.name.toLowerCase().includes(q));
  }, [teamScopes, query]);

  const close = (restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  // Click-outside + Escape. Escape is handled in the capture phase and
  // stops propagation so an open popover doesn't also close a host's own
  // modal it happens to be rendered inside of — best-effort (a listener
  // the host itself attached in an earlier-registered capture phase will
  // still win), but the common case (a host's own bubble-phase handler)
  // is reliably intercepted.
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      close(true);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    } else {
      setQuery("");
      setPosition(null);
    }
  }, [open]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [filtered]);

  // Re-measure on scroll/resize while open — `scroll` is registered with
  // capture because it doesn't bubble, so this is the only way to hear
  // about a scroll on an ancestor container, not just the window.
  useEffect(() => {
    if (!open) return;
    const recompute = () => setPosition(computePopoverPosition(triggerRef.current, popoverRef.current));
    window.addEventListener("resize", recompute);
    document.addEventListener("scroll", recompute, true);
    return () => {
      window.removeEventListener("resize", recompute);
      document.removeEventListener("scroll", recompute, true);
    };
  }, [open]);

  // Once the portal has actually mounted, its real height is known —
  // refine the provisional position computed at open-time (see toggleOpen
  // below) in case it was estimated slightly wrong. Layout effect so this
  // correction happens before paint, not as a visible jump.
  useLayoutEffect(() => {
    if (!open) return;
    setPosition(computePopoverPosition(triggerRef.current, popoverRef.current));
  }, [open]);

  const toggleOpen = () => {
    if (!open) {
      // Computed eagerly, in the same event as `setOpen`, so the popover
      // is never rendered mid-flight without a position — that would mean
      // gating it invisible until measured, and a `visibility: hidden`
      // element can't receive focus, which broke focusing the search
      // input on open. Refined above once the real size is known.
      setPosition(computePopoverPosition(triggerRef.current, null));
    }
    setOpen((o) => !o);
  };

  const selectedVisual = selected ? HEADLINE_VISUAL[headlineByScope[selected.id]] : undefined;
  const highlighted = filtered[highlightedIndex];
  const highlightedId = highlighted ? `${listboxId}-option-${highlighted.id}` : undefined;

  const selectScope = (scopeId: string) => {
    onSelect(scopeId);
    close(true);
  };

  const handleInputKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((i) => Math.max(i - 1, 0));
        break;
      case "Home":
        e.preventDefault();
        setHighlightedIndex(0);
        break;
      case "End":
        e.preventDefault();
        setHighlightedIndex(filtered.length - 1);
        break;
      case "Enter":
        e.preventDefault();
        if (highlighted) selectScope(highlighted.id);
        break;
    }
  };

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleOpen}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={
          selected
            ? {
                backgroundColor: "var(--schedio-brand-primary, #18181b)",
                borderColor: "var(--schedio-brand-primary, #18181b)",
                color: "var(--schedio-brand-primary-foreground, #ffffff)",
              }
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
        <span className="truncate">
          {selected ? selected.name : `${tenant.copy.scopesLabel} (${teamScopes.length})`}
        </span>
        <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
      </button>

      {mounted &&
        open &&
        createPortal(
          <div
            ref={popoverRef}
            // Reapplied here because a portal renders outside this
            // component's own DOM subtree, escaping both the scoped
            // stylesheet's `.schedio-embed-root` ancestor requirement and
            // (CSS custom properties don't cross a portal boundary either)
            // the brand color variables set on TenantConfigProvider's
            // wrapper — re-derived straight from the same tenant config
            // rather than trusting the disconnected DOM tree to still
            // carry them.
            className={cx(
              "schedio-embed-root fixed z-50 w-72 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950",
              colorSchemeClassName,
            )}
            style={{
              // `position` is computed synchronously in `toggleOpen`
              // before `open` flips true, so it's never null on a render
              // where the popover is actually visible — this fallback is
              // purely defensive.
              top: position?.top ?? -9999,
              left: position?.left ?? -9999,
              "--schedio-brand-primary": tenant.brand.colors.primary,
              "--schedio-brand-primary-foreground": tenant.brand.colors.primaryForeground,
            } as CSSProperties}
          >
            <div className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2 dark:border-zinc-900">
              <SearchIcon className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden />
              <input
                ref={inputRef}
                role="combobox"
                aria-expanded="true"
                aria-controls={listboxId}
                aria-activedescendant={highlightedId}
                aria-autocomplete="list"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder={`Find a ${tenant.copy.scopeLabel} (${teamScopes.length})...`}
                className="w-full bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100"
              />
            </div>
            <div id={listboxId} role="listbox" className="max-h-64 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <p className="px-3 py-4 text-center text-sm text-zinc-400">
                  {tenant.copy.noScopesMatchLabel} &ldquo;{query}&rdquo;
                </p>
              ) : (
                filtered.map((scope, i) => {
                  const isSelected = scope.id === selectedScopeId;
                  const isHighlighted = i === highlightedIndex;
                  const visual = HEADLINE_VISUAL[headlineByScope[scope.id]];
                  return (
                    <button
                      key={scope.id}
                      id={`${listboxId}-option-${scope.id}`}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setHighlightedIndex(i)}
                      onClick={() => selectScope(scope.id)}
                      className={cx(
                        "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                        isSelected || isHighlighted ? "bg-zinc-100 dark:bg-zinc-900" : "hover:bg-zinc-50 dark:hover:bg-zinc-900/60",
                      )}
                    >
                      {visual && <span className={cx("h-1.5 w-1.5 shrink-0 rounded-full", visual.dot)} />}
                      <span className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-300">{scope.name}</span>
                      {isSelected && <CheckIcon className="h-3.5 w-3.5 shrink-0 text-zinc-500 dark:text-zinc-400" aria-hidden />}
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
