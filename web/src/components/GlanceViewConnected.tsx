"use client";

import { useRouter } from "next/navigation";
import { GlanceView } from "@schedio/embed";

/**
 * This is the pattern a host app would follow: a real `href` (so
 * right-click/middle-click/hover-preview work like any other link) plus
 * `onJobSelect` calling the host's own router for fast client-side
 * navigation instead of a full page reload. @schedio/embed doesn't know
 * Next.js exists — this is the one place that bridges the two.
 */
export function GlanceViewConnected() {
  const router = useRouter();
  return <GlanceView getJobHref={(jobId) => `/jobs/${jobId}`} onJobSelect={(jobId) => router.push(`/jobs/${jobId}`)} />;
}
