"use client";

import { useRouter } from "next/navigation";
import { GlanceView } from "@schedio/embed";
import { useAppConnector } from "./AppConnectorProvider";
import { jobHref } from "@/lib/jobRoutes";

/**
 * This is the pattern a host app would follow: a real `href` (so
 * right-click/middle-click/hover-preview work like any other link) plus
 * `onJobSelect` calling the host's own router for fast client-side
 * navigation instead of a full page reload. @schedio/embed doesn't know
 * Next.js exists — this is the one place that bridges the two.
 *
 * `connector` is undefined in "single" mode (GlanceView's own default
 * mock connector) and a `combineConnectors` result in "combined" mode —
 * see AppConnectorProvider. GlanceView itself doesn't know or care which.
 */
export function GlanceViewConnected() {
  const router = useRouter();
  const { connector } = useAppConnector();
  return (
    <GlanceView
      connector={connector}
      // Defaults to false once a custom `connector` is passed — but ours
      // is still the mock underneath (in both modes), so the outage
      // simulator still applies and is worth keeping visible.
      showDemoControls
      getJobHref={jobHref}
      onJobSelect={(jobId) => router.push(jobHref(jobId))}
    />
  );
}
