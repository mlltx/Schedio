"use client";

import { useRouter } from "next/navigation";
import { PipelineGraphView } from "@schedio/embed";
import { useScopedConnector } from "./useScopedConnector";
import { jobHref } from "@/lib/jobRoutes";

/** Same doorway pattern as GlanceViewConnected/JobDetailConnected — a real href plus a router callback. */
export function PipelineGraphViewConnected({ jobId }: { jobId: string }) {
  const router = useRouter();
  const connector = useScopedConnector();
  return (
    <PipelineGraphView
      jobId={jobId}
      connector={connector}
      backHref={jobHref(jobId)}
      onBack={() => router.push(jobHref(jobId))}
      getJobHref={jobHref}
      onJobSelect={(id) => router.push(jobHref(id))}
    />
  );
}
