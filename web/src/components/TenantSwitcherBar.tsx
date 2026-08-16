"use client";

import { TenantSwitcher, TENANT_PRESETS } from "@schedio/embed";
import { useAppTenantId } from "./AppTenantProvider";

/**
 * Lives above <GlanceView>, not inside it — GlanceView itself has no idea
 * multiple tenants exist, on purpose (see AppTenantProvider). This is
 * purely our own demo chrome proving the branding/terminology swap is
 * real, the same role DemoControls plays for the connector-outage case.
 */
export function TenantSwitcherBar() {
  const { id, setId } = useAppTenantId();
  return (
    <div className="mx-auto flex w-full max-w-2xl justify-end px-4 pt-6 sm:px-6 sm:pt-8">
      <TenantSwitcher tenants={TENANT_PRESETS} selectedId={id} onSelect={setId} />
    </div>
  );
}
