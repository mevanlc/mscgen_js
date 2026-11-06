import type { Hidden } from "../../parse/mscgenjsast";

let pending: SVGElement[] = [];

export function resetVisibility(): void {
  pending = [];
}

/** Keep every component measurable until the complete layout is finished. */
export function deferVisibility<T extends SVGElement>(
  element: T,
  hidden?: Hidden,
): T {
  if (hidden === true) pending.push(element);
  return element;
}

export function applyVisibility(): void {
  for (const element of pending) {
    if (element.isConnected) {
      element.style.visibility = "hidden";
      element.style.pointerEvents = "none";
      element.setAttribute("aria-hidden", "true");
    }
  }
  pending = [];
}
