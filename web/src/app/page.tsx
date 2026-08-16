import { GlanceViewConnected } from "@/components/GlanceViewConnected";
import { PreviewControlsBar } from "@/components/PreviewControlsBar";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <PreviewControlsBar />
      <GlanceViewConnected />
    </div>
  );
}
