import { JobDetailConnected } from "@/components/JobDetailConnected";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // This Next.js version does not decode dynamic segment params itself
  // (confirmed empirically, not assumed — see web/AGENTS.md) — job ids
  // are encoded on the way out (see web/src/lib/jobRoutes.ts, needed for
  // combineConnectors-namespaced ids like "us-east:some-job") and must be
  // decoded back on the way in.
  return <JobDetailConnected jobId={decodeURIComponent(id)} />;
}
