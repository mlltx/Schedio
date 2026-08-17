import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { mockConnector, withScopeAccess, serializeSnapshot } from "@schedio/embed/server";
import { combinedDemoConnector, expandScopeIdsForRegions } from "@/lib/demoConnectors";
import { permissionsFor, PREVIEW_USER_COOKIE } from "@/lib/mockUsers";

/**
 * This is the fix for the gap called out in withScopeAccess's own docs:
 * GlanceView/JobDetail are client components, so a connector wrapped in
 * withScopeAccess *in the browser* still puts the unfiltered network
 * response in reach of anyone with dev tools open. Running the connector
 * here instead closes that — the browser only ever receives the JSON this
 * route decides to send back, already filtered.
 *
 * `mode` is read from the query string and trusted as-is — it only selects
 * which mock dataset to use (single vs. two combined "instances"), so a
 * client choosing it carries no access implications. `userId` is the part
 * that matters, and it is deliberately *not* read from the query string:
 * it comes from an httpOnly cookie set by `setPreviewUser` (a Server
 * Function), so a viewer can't just edit `?userId=admin` in the URL to see
 * more than they should. This is the demo's stand-in for "resolve
 * Permissions from a verified session" — same shape a real deployment
 * would follow with its own auth instead of a cookie holding a mock user id.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") === "combined" ? "combined" : "single";

  let reachabilityOverrides: Record<string, boolean> = {};
  const rawOverrides = url.searchParams.get("overrides");
  if (rawOverrides) {
    try {
      reachabilityOverrides = JSON.parse(rawOverrides);
    } catch {
      // Malformed input from a value we don't trust for correctness either
      // (just the outage-simulator demo toggle) — ignore rather than 400.
    }
  }

  const store = await cookies();
  const permissions = permissionsFor(store.get(PREVIEW_USER_COOKIE)?.value);

  const baseConnector = mode === "combined" ? combinedDemoConnector : mockConnector;
  const scopeIds = mode === "combined" ? expandScopeIdsForRegions(permissions.scopeIds) : permissions.scopeIds;

  const snapshot = await withScopeAccess(baseConnector, scopeIds)(new Date(), reachabilityOverrides);
  return NextResponse.json(serializeSnapshot(snapshot));
}
