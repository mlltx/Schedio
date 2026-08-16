import { JobDetailConnected } from "@/components/JobDetailConnected";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <JobDetailConnected jobId={id} />;
}
