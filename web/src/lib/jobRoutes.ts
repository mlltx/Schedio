/**
 * Job ids can contain characters a raw URL path segment shouldn't carry
 * unescaped — notably `:`, which `combineConnectors`-namespaced ids use
 * (e.g. "us-east:build-revenue-facts") and which is a known URL-parsing
 * edge case: a colon in a path's first segment can be misread as a scheme
 * separator. Next.js's dynamic route params are decoded automatically, so
 * encoding here and reading `params.id` as-is on the other end round-trips
 * correctly.
 */
export function jobHref(jobId: string): string {
  return `/jobs/${encodeURIComponent(jobId)}`;
}

export function jobPipelineHref(jobId: string): string {
  return `/jobs/${encodeURIComponent(jobId)}/pipeline`;
}
