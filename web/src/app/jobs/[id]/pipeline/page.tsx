import { PipelineGraphViewConnected } from "@/components/PipelineGraphViewConnected";

export default async function PipelineGraphPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // See jobs/[id]/page.tsx — this Next.js version doesn't decode dynamic
  // segment params itself; job ids are encoded going out (jobRoutes.ts).
  return (
    <div className="flex h-dvh flex-col bg-zinc-50 dark:bg-black">
      <PipelineGraphViewConnected jobId={decodeURIComponent(id)} />
    </div>
  );
}
