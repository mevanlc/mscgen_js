import type { Hidden, IArc, ISequenceChart } from "./mscgenjsast";

export function parseHidden(value: string): Hidden {
  switch (value.toLowerCase()) {
    case "true":
      return true;
    case "false":
      return false;
    case "inherit":
      return "inherit";
    default:
      throw new Error("hidden must be true, false, or inherit");
  }
}

export function hasHiddenAttributes(
  chart: Pick<ISequenceChart, "entities" | "arcs">,
): boolean {
  const inArcs = (rows?: IArc[][]): boolean =>
    (rows || []).some((row) =>
      row.some(
        (arc) =>
          Object.prototype.hasOwnProperty.call(arc, "hidden") ||
          inArcs(arc.arcs),
      ),
    );
  return (
    (chart.entities || []).some((entity) =>
      Object.prototype.hasOwnProperty.call(entity, "hidden"),
    ) || inArcs(chart.arcs)
  );
}

export function assertVisibilitySupported(
  chart: ISequenceChart,
  target: string,
): void {
  if (hasHiddenAttributes(chart)) {
    throw new Error(
      `${target} cannot preserve hidden attributes. Use Xu, JSON, SVG, PNG, or JPEG instead.`,
    );
  }
}

/** Resolve only syntactic ancestry, never references to entity names. */
export function resolveVisibility(chart: ISequenceChart): ISequenceChart {
  const result = structuredClone(chart);
  function resolve(value: Hidden | undefined, parent: boolean): boolean {
    if (value === undefined || value === "inherit") return parent;
    if (typeof value === "boolean") return value;
    throw new Error("hidden must be true, false, or inherit");
  }
  const inArcs = (rows?: IArc[][], parent = false): void => {
    (rows || []).forEach((row) =>
      row.forEach((arc) => {
        arc.hidden = resolve(arc.hidden, parent);
        inArcs(arc.arcs, arc.hidden);
      }),
    );
  };
  result.entities.forEach((entity) => {
    entity.hidden = resolve(entity.hidden, false);
  });
  inArcs(result.arcs);
  return result;
}
