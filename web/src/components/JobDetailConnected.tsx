"use client";

import { useRouter } from "next/navigation";
import { JobDetail } from "@schedio/embed";

export function JobDetailConnected({ jobId }: { jobId: string }) {
  const router = useRouter();
  return <JobDetail jobId={jobId} backHref="/" onBack={() => router.push("/")} />;
}
