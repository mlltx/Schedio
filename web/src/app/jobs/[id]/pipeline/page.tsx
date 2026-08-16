import { PipelineGraphViewConnected } from "@/components/PipelineGraphViewConnected";

export default async function PipelineGraphPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="flex h-dvh flex-col bg-zinc-50 dark:bg-black">
      <PipelineGraphViewConnected jobId={id} />
    </div>
  );
}
