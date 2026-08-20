"use client";

export interface PopoverPosition {
  top: number;
  left: number;
}

/**
 * Fixed-position coordinates for a popover, measured from its trigger's
 * viewport rect — not `absolute`, so it can't be clipped by a host
 * ancestor's `overflow: hidden`. Meant to be paired with portaling the
 * popover to `document.body` (see ScopeSwitcher's `TeamScopePicker` and
 * PipelineGraphView's search-match dropdown for the two callers), so it's
 * not appended inside the host's own layout at all either. Flips
 * above/left when it wouldn't fit below/right.
 *
 * `popover` is `null` before the portal has actually mounted —
 * `fallbackWidth`/`fallbackHeight` (defaulting to this popover's
 * approximate size) stand in until then, so there's always a real
 * position to render at rather than something gated invisible until
 * measured (a `visibility: hidden` element can't receive focus, which is
 * why this matters beyond just avoiding a flash of mispositioned content).
 */
export function computePopoverPosition(
  trigger: HTMLElement | null,
  popover: HTMLElement | null,
  fallbackWidth = 288,
  fallbackHeight = 320,
): PopoverPosition | null {
  if (!trigger) return null;
  const triggerRect = trigger.getBoundingClientRect();
  const popoverRect = popover?.getBoundingClientRect();
  const popoverWidth = popoverRect?.width ?? fallbackWidth;
  const popoverHeight = popoverRect?.height ?? fallbackHeight;
  const gap = 8;
  const margin = 8;

  let top = triggerRect.bottom + gap;
  if (top + popoverHeight > window.innerHeight - margin) {
    const above = triggerRect.top - popoverHeight - gap;
    if (above >= margin) top = above;
  }

  let left = triggerRect.left;
  if (left + popoverWidth > window.innerWidth - margin) {
    left = Math.max(margin, triggerRect.right - popoverWidth);
  }

  return { top, left };
}
