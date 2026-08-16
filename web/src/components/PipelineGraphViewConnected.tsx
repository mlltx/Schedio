"use client";

import { useRouter } from "next/navigation";
import { PipelineGraphView } from "@schedio/embed";

/** Same doorway pattern as GlanceViewConnected/JobDetailConnected — a real href plus a router callback. */
export function PipelineGraphViewConnected({ jobId }: { jobId: string }) {
  const router = useRouter();
  return (
    <PipelineGraphView
      jobId={jobId}
      backHref={`/jobs/${jobId}`}
      onBack={() => router.push(`/jobs/${jobId}`)}
      getJobHref={(id) => `/jobs/${id}`}
      onJobSelect={(id) => router.push(`/jobs/${id}`)}
    />
  );
}
