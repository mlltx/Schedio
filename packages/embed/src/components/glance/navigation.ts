/**
 * The package can't assume it owns routing — an embedding host has its own
 * URL structure. Both props are optional and composable, the same pattern
 * `next/link`/react-router's `Link` use internally: a real `href` (for
 * SEO, hover previews, middle-click/"open in new tab") plus an optional
 * intercept for client-side routing. Give just `onJobSelect` for a pure
 * SPA callback, just `getJobHref` for plain full-navigation anchors, or
 * both for a client-routed real link.
 */
export interface JobNavigation {
  getJobHref?: (jobId: string) => string;
  onJobSelect?: (jobId: string) => void;
}
