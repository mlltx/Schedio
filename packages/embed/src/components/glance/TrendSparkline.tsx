import type { TrendPoint } from "@/model";
import { formatShortDate } from "./format";

/**
 * Fourteen days of failure counts as a row of bars, so "3 failures today"
 * has something to be compared against — is that a normal Tuesday, or a
 * spike? Today's bar is outlined so it's easy to find at a glance.
 */
export function TrendSparkline({ trend }: { trend: TrendPoint[] }) {
  const max = Math.max(1, ...trend.map((p) => p.failedCount));

  return (
    <div className="flex items-end gap-1" role="img" aria-label="Failures over the last 14 days">
      {trend.map((point, i) => {
        const isToday = i === trend.length - 1;
        const heightPct = Math.max(10, (point.failedCount / max) * 100);
        return (
          <div
            key={point.date}
            title={`${formatShortDate(point.date)}: ${point.failedCount} failure${point.failedCount === 1 ? "" : "s"}`}
            className="flex h-9 w-3 items-end sm:w-3.5"
          >
            <div
              className={`w-full rounded-sm transition-all ${
                point.failedCount === 0
                  ? "bg-current opacity-15"
                  : isToday
                    ? "bg-current opacity-90 ring-1 ring-current"
                    : "bg-current opacity-50"
              }`}
              style={{ height: `${heightPct}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}
