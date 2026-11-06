let state: number | undefined;

/** Visibility changes must not change the seed or the drawing-call sequence. */
export function seedRandom(chart: unknown): void {
  const content = JSON.stringify(chart, (key, value) =>
    key === "hidden" ? undefined : value,
  );
  let hash = 2166136261;
  for (let index = 0; index < content.length; index++) {
    hash = Math.imul(hash ^ content.charCodeAt(index), 16777619);
  }
  state = hash >>> 0;
}

export function clearRandom(): void {
  state = undefined;
}

export function random(): number {
  if (state === undefined) return Math.random();
  state = (Math.imul(1664525, state) + 1013904223) >>> 0;
  return state / 4294967296;
}
