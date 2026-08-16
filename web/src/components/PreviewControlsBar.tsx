"use client";

import { TenantSwitcher, TENANT_PRESETS } from "@schedio/embed";
import { useAppTenantId } from "./AppTenantProvider";
import { ConnectorModeSwitcher } from "./ConnectorModeSwitcher";

/**
 * Lives above <GlanceView>, not inside it — GlanceView itself has no idea
 * multiple tenants or multiple connectors exist, on purpose (see
 * AppTenantProvider/AppConnectorProvider). This is purely our own demo
 * chrome proving the branding/terminology swap and the multi-connector
 * merge are both real, the same role DemoControls plays for the
 * connector-outage case.
 */
export function PreviewControlsBar() {
  const { id, setId } = useAppTenantId();
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-wrap justify-end gap-3 px-4 pt-6 sm:px-6 sm:pt-8">
      <ConnectorModeSwitcher />
      <TenantSwitcher tenants={TENANT_PRESETS} selectedId={id} onSelect={setId} />
    </div>
  );
}
