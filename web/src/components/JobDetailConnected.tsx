"use client";

import { useRouter } from "next/navigation";
import { JobDetail } from "@schedio/embed";
import { useAppConnector } from "./AppConnectorProvider";
import { jobHref, jobPipelineHref } from "@/lib/jobRoutes";

export function JobDetailConnected({ jobId }: { jobId: string }) {
  const router = useRouter();
  const { connector } = useAppConnector();
  return (
    <JobDetail
      jobId={jobId}
      connector={connector}
      backHref="/"
      onBack={() => router.push("/")}
      getJobHref={jobHref}
      onJobSelect={(id) => router.push(jobHref(id))}
      getPipelineHref={jobPipelineHref}
      onViewPipeline={(id) => router.push(jobPipelineHref(id))}
    />
  );
}
