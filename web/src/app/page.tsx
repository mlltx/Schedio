import { GlanceViewConnected } from "@/components/GlanceViewConnected";
import { TenantSwitcherBar } from "@/components/TenantSwitcherBar";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <TenantSwitcherBar />
      <GlanceViewConnected />
    </div>
  );
}
