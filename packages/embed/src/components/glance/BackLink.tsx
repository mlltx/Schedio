"use client";

import { ArrowLeftIcon } from "./icons";
import { NavLink } from "./NavLink";
import { cx } from "./cx";

/** Shared by JobDetail and PipelineGraphView — same doorway pattern, just a different label/spacing. */
export function BackLink({
  backHref,
  onBack,
  label,
  className,
}: {
  backHref?: string;
  onBack?: () => void;
  label: string;
  className?: string;
}) {
  if (!backHref && !onBack) return null;
  return (
    <NavLink
      href={backHref}
      onActivate={onBack}
      className={cx(
        "inline-flex w-fit items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200",
        className,
      )}
    >
      <ArrowLeftIcon className="h-4 w-4" aria-hidden />
      {label}
    </NavLink>
  );
}
