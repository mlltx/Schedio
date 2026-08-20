import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ClockIcon,
  MoonIcon,
  OctagonAlertIcon,
  RefreshCwIcon,
  SparklesIcon,
  UnplugIcon,
  type IconComponent,
} from "./icons";
import type { HeadlineKind, Severity } from "../../model";

/**
 * One place for what each state looks like, so a color never means two
 * different things in two different parts of the screen.
 */

export interface Visual {
  dot: string;
  text: string;
  ring: string;
  bannerBg: string;
  bannerBorder: string;
  bannerText: string;
  icon: IconComponent;
}

const emerald: Visual = {
  dot: "bg-emerald-500",
  text: "text-emerald-700 dark:text-emerald-400",
  ring: "ring-emerald-500/20",
  bannerBg: "bg-emerald-50 dark:bg-emerald-950/40",
  bannerBorder: "border-emerald-200 dark:border-emerald-900",
  bannerText: "text-emerald-900 dark:text-emerald-100",
  icon: CheckCircle2Icon,
};

const red: Visual = {
  dot: "bg-red-600",
  text: "text-red-700 dark:text-red-400",
  ring: "ring-red-600/20",
  bannerBg: "bg-red-50 dark:bg-red-950/40",
  bannerBorder: "border-red-200 dark:border-red-900",
  bannerText: "text-red-900 dark:text-red-100",
  icon: OctagonAlertIcon,
};

const orange: Visual = {
  dot: "bg-orange-500",
  text: "text-orange-700 dark:text-orange-400",
  ring: "ring-orange-500/20",
  bannerBg: "bg-orange-50 dark:bg-orange-950/40",
  bannerBorder: "border-orange-200 dark:border-orange-900",
  bannerText: "text-orange-900 dark:text-orange-100",
  icon: AlertTriangleIcon,
};

const amber: Visual = {
  dot: "bg-amber-500",
  text: "text-amber-700 dark:text-amber-400",
  ring: "ring-amber-500/20",
  bannerBg: "bg-amber-50 dark:bg-amber-950/40",
  bannerBorder: "border-amber-200 dark:border-amber-900",
  bannerText: "text-amber-900 dark:text-amber-100",
  icon: ClockIcon,
};

const blue: Visual = {
  dot: "bg-blue-500",
  text: "text-blue-700 dark:text-blue-400",
  ring: "ring-blue-500/20",
  bannerBg: "bg-blue-50 dark:bg-blue-950/40",
  bannerBorder: "border-blue-200 dark:border-blue-900",
  bannerText: "text-blue-900 dark:text-blue-100",
  icon: RefreshCwIcon,
};

const zinc: Visual = {
  dot: "bg-zinc-400 dark:bg-zinc-500",
  text: "text-zinc-600 dark:text-zinc-400",
  ring: "ring-zinc-400/20",
  bannerBg: "bg-zinc-100 dark:bg-zinc-900",
  bannerBorder: "border-zinc-300 dark:border-zinc-700 border-dashed",
  bannerText: "text-zinc-700 dark:text-zinc-300",
  icon: UnplugIcon,
};

const sky: Visual = {
  dot: "bg-sky-400",
  text: "text-sky-700 dark:text-sky-400",
  ring: "ring-sky-400/20",
  bannerBg: "bg-sky-50 dark:bg-sky-950/40",
  bannerBorder: "border-sky-200 dark:border-sky-900",
  bannerText: "text-sky-900 dark:text-sky-100",
  icon: MoonIcon,
};

// Same neutral coloring as "unreachable", but a distinct icon — this is
// "nothing has come in yet" (newly connected), not "we lost contact with a
// source that used to report", and those shouldn't look identical.
const zincNoData: Visual = { ...zinc, icon: SparklesIcon };

export const SEVERITY_VISUAL: Record<Severity, Visual> = {
  healthy: emerald,
  recovering: blue,
  late: amber,
  missing: amber,
  needs_attention: orange,
  critical: red,
  outage: zinc,
  unknown: zincNoData,
};

export const HEADLINE_VISUAL: Record<HeadlineKind, Visual> = {
  healthy: emerald,
  needs_attention: orange,
  critical: red,
  unreachable: zinc,
  no_data: zincNoData,
  empty: sky,
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  healthy: "Healthy",
  recovering: "Recovering",
  late: "Running late",
  missing: "Missing",
  needs_attention: "Needs attention",
  critical: "Critical",
  outage: "Can't verify",
  unknown: "No data yet",
};
