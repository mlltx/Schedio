import type { TimeWindow } from "@/model";

const OPTIONS: { value: TimeWindow; label: string }[] = [
  { value: "since_midnight", label: "Since midnight" },
  { value: "last_24h", label: "Last 24 hours" },
  { value: "last_7d", label: "Last 7 days" },
];

export function TimeWindowPicker({
  value,
  onChange,
}: {
  value: TimeWindow;
  onChange: (window: TimeWindow) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Time window"
      className="inline-flex rounded-lg border border-zinc-200 bg-zinc-100 p-0.5 text-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      {OPTIONS.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(opt.value)}
            className={`rounded-md px-3 py-1.5 font-medium whitespace-nowrap transition-colors ${
              isSelected
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
