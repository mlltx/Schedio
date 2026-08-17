"use client";

import { useAppPermissions, MOCK_USERS, type MockUserId } from "./AppPermissionsProvider";

/**
 * Demo-only, same reasoning as ConnectorModeSwitcher: a real host resolves
 * `Permissions` from its own signed-in user, it doesn't offer a runtime
 * switcher — this exists purely to make "not everyone sees everything"
 * visible without wiring up real auth.
 */
export function UserRoleSwitcher() {
  const { userId, setUserId } = useAppPermissions();

  return (
    <label className="flex shrink-0 items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500">
      <span className="hidden sm:inline">Viewing as</span>
      <select
        value={userId}
        onChange={(e) => setUserId(e.target.value as MockUserId)}
        className="rounded-md border border-zinc-200 bg-white px-1.5 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
        aria-label="Preview Schedio as a different user, with different scope access"
      >
        {(Object.entries(MOCK_USERS) as [MockUserId, (typeof MOCK_USERS)[MockUserId]][]).map(([id, user]) => (
          <option key={id} value={id}>
            {user.label}
          </option>
        ))}
      </select>
    </label>
  );
}
