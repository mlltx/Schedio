"use client";

import type { ReactNode } from "react";

/**
 * The shared shape behind every navigable element in this package: a real
 * `href` (accessibility, middle-click, hover preview) optionally
 * intercepted by a callback for client-side routing — the same pattern
 * `next/link` uses internally. Always renders (never `null`); callers that
 * want to render nothing when neither prop is given (e.g. "Back to
 * glance" with no destination configured) decide that themselves before
 * reaching for this.
 */
export function NavLink({
  href,
  onActivate,
  className,
  children,
}: {
  href?: string;
  onActivate?: () => void;
  className?: string;
  children: ReactNode;
}) {
  if (href) {
    return (
      <a
        href={href}
        onClick={onActivate ? (e) => (e.preventDefault(), onActivate()) : undefined}
        className={className}
      >
        {children}
      </a>
    );
  }

  return (
    <button type="button" onClick={onActivate} className={className}>
      {children}
    </button>
  );
}
