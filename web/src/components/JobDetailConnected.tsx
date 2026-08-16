"use client";

import { useRouter } from "next/navigation";
import { JobDetail } from "@schedio/embed";

export function JobDetailConnected({ jobId }: { jobId: string }) {
  const router = useRouter();
  return (
    <JobDetail
      jobId={jobId}
      backHref="/"
      onBack={() => router.push("/")}
      getJobHref={(id) => `/jobs/${id}`}
      onJobSelect={(id) => router.push(`/jobs/${id}`)}
      getPipelineHref={(id) => `/jobs/${id}/pipeline`}
      onViewPipeline={(id) => router.push(`/jobs/${id}/pipeline`)}
    />
  );
}
