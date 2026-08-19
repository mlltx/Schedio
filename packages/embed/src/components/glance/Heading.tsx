import type { ReactNode } from "react";

/**
 * A host embedding GlanceView/JobDetail/PipelineGraphView already has its
 * own document heading outline — hardcoding `<h1>` on whatever's most
 * visually prominent in each of these means an embedded widget always
 * introduces a *second* `<h1>` (or a third and fourth, one embedded
 * multiple times on one page), which is exactly the kind of assumption
 * "the component owns the whole page" that doesn't hold for an embed. Each
 * top-level component takes a `headingLevel` prop (default `1`, so nothing
 * changes for a host that doesn't set it) and renders through this instead
 * of a literal tag.
 */
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export function Heading({
  level = 1,
  className,
  children,
}: {
  level?: HeadingLevel;
  className?: string;
  children: ReactNode;
}) {
  const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  return <Tag className={className}>{children}</Tag>;
}
