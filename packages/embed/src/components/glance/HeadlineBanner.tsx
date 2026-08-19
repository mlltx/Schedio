import type { ScopeStatus } from "../../model";
import { HEADLINE_VISUAL } from "./visuals";
import { TrendSparkline } from "./TrendSparkline";
import { Heading, type HeadingLevel } from "./Heading";

export function HeadlineBanner({ view, headingLevel }: { view: ScopeStatus; headingLevel?: HeadingLevel }) {
  const visual = HEADLINE_VISUAL[view.headline];
  const Icon = visual.icon;
  const showTrend = view.headline !== "no_data" && view.trend.some((p) => p.totalCount > 0);

  return (
    <div className={`rounded-2xl border px-6 py-8 sm:px-8 sm:py-10 ${visual.bannerBg} ${visual.bannerBorder}`}>
      <div className="flex items-start gap-4">
        <div className={`shrink-0 rounded-full bg-white/70 p-2.5 dark:bg-black/20 ${visual.text}`}>
          <Icon className="h-7 w-7" strokeWidth={2} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <Heading level={headingLevel} className={`text-2xl font-semibold tracking-tight sm:text-3xl ${visual.bannerText}`}>
            {view.headlineCopy}
          </Heading>
          <p className={`mt-1.5 text-base ${visual.bannerText} opacity-80`}>{view.subCopy}</p>

          {showTrend && (
            <div className="mt-5">
              <TrendSparkline trend={view.trend} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
