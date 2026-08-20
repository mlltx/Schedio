"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { SEVERITY_VISUAL } from "../glance/visuals";
import { NavLink } from "../glance/NavLink";
import type { FlowNodeData } from "./layout";

const handleClass = "!h-1.5 !w-1.5 !border-0 !bg-zinc-400 dark:!bg-zinc-500";

export function GraphJobNode({ data }: NodeProps<Node<FlowNodeData>>) {
  const visual = SEVERITY_VISUAL[data.severity];
  const clickable = data.href !== undefined || data.onActivate !== undefined;

  const body = (
    <>
      <div className="flex items-center gap-1.5">
        <span className={`h-2 w-2 shrink-0 rounded-full ${visual.dot}`} />
        <span className={`truncate text-[13px] font-semibold ${visual.bannerText}`}>{data.jobName}</span>
      </div>
      <p className={`mt-1 truncate text-[11px] ${visual.bannerText} opacity-80`}>{data.headline}</p>
      {data.isFocal && <p className="mt-0.5 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">You are here</p>}
    </>
  );

  const wrapperClass = [
    "block w-[216px] rounded-xl border px-3 py-2.5 shadow-sm transition-opacity",
    visual.bannerBg,
    visual.bannerBorder,
    data.isFocal ? "outline outline-2 outline-dashed outline-offset-2 outline-zinc-900 dark:outline-zinc-100" : "",
    data.dimmed ? "opacity-20" : "",
    clickable ? "cursor-pointer hover:brightness-95 dark:hover:brightness-110" : "",
  ].join(" ");

  return (
    <div className="nodrag">
      <Handle type="target" position={Position.Left} className={handleClass} />
      <Handle type="source" position={Position.Right} className={handleClass} />
      {clickable ? (
        <NavLink href={data.href} onActivate={data.onActivate} className={wrapperClass}>
          {body}
        </NavLink>
      ) : (
        <div className={wrapperClass}>{body}</div>
      )}
    </div>
  );
}
