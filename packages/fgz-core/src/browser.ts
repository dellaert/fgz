import type { FactorGraph, GraphFactor, GraphVariable } from "./factor-graph.js";

export { parseFgz } from "./parser.js";
export { toFactorGraph, type FactorGraph, type GraphVariable, type GraphFactor } from "./factor-graph.js";

const ink = "#243438";
const grid = 48;

function append<K extends keyof SVGElementTagNameMap>(
  parent: Element,
  tag: K,
  attributes: Record<string, string | number> = {}
): SVGElementTagNameMap[K] {
  const element = parent.ownerDocument.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, String(value));
  }
  parent.appendChild(element);
  return element;
}

// Only simple trailing subscripts get math typography. All other labels remain literal text.
const trailingSubscript = /^([\p{L}\p{N}]+)_(?:\{([\p{L}\p{N}+-]+)\}|([\p{L}\p{N}]))$/u;

function label(parent: Element, value: string) {
  const text = append(parent, "text", { fill: ink, "dominant-baseline": "central" });
  const sub = trailingSubscript.exec(value);
  if (sub) {
    text.textContent = sub[1]!;
    append(text, "tspan", { "baseline-shift": "sub", "font-size": "72%" }).textContent = sub[2] ?? sub[3]!;
  } else {
    text.textContent = value;
  }
  return text;
}

function labelRadius(value: string, minimum: number) {
  // A 13px monospace character is about 8px wide. Include room at both ends.
  const characters = trailingSubscript.test(value) ? value.replace(/[{}_]/g, "").length : value.length;
  return Math.max(minimum, characters * 4.2 + 4);
}

function glyph(parent: Element, radius: number, square: boolean, fill: string) {
  return square
    ? append(parent, "rect", { x: -radius, y: -radius, width: 2 * radius, height: 2 * radius, fill })
    : append(parent, "circle", { r: radius, fill });
}

type Position = Pick<GraphVariable, "x" | "y">;

/** Optional layout and selection policies for an embedded graph. */
export interface FactorGraphRenderOptions {
  /** Use native SVG pixel coordinates in a fixed canvas instead of fitting a y-up fgz layout. */
  viewport?: { width: number; height: number };
  /** Point where a factor's incidence line meets the variable, in graph coordinates. */
  edgeEndpoint?: (factor: GraphFactor, variable: GraphVariable) => Position | undefined;
  onSelect?: (variableId: string) => void;
  /** Only these variables can be selected by the user or host. Evaluated at mount. */
  isSelectable?: (variable: GraphVariable) => boolean;
  /** Only these factors react to selection and highlight neighbors. Evaluated at mount. */
  isHighlightable?: (factor: GraphFactor) => boolean;
}

/**
 * Mount an interactive SVG in a host element, replacing its contents.
 * Click, Enter, and Space select a variable and notify the host.
 * The host can update or clear selection without triggering the callback.
 */
export function renderFactorGraph(
  container: Element,
  graph: FactorGraph,
  options: FactorGraphRenderOptions = {}
) {
  const svg = container.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("role", "group");
  svg.setAttribute("aria-label", "Factor graph");
  svg.setAttribute("text-anchor", "middle");
  svg.setAttribute("font-family", "ui-monospace, monospace");
  svg.setAttribute("font-size", "13");
  const { viewport } = options;
  if (viewport) {
    const { width, height } = viewport;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      throw new RangeError("Viewport width and height must be positive finite numbers");
    }
  } else {
    svg.style.maxWidth = "100%";
    svg.style.height = "auto";
  }

  const edges = append(svg, "g", { "aria-hidden": "true" });
  const markers = append(svg, "g");
  const nodes = append(svg, "g");
  const positions = new Map(graph.variables.map(v => [v.id, v]));
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  // Include glyphs and incidence endpoints in the bounds of an automatically fitted graph.
  function svgPoint(point: Position, radius = 0): Position {
    if (viewport) return point;
    const x = grid * point.x;
    const y = -grid * point.y;
    left = Math.min(left, x - radius);
    right = Math.max(right, x + radius);
    top = Math.min(top, y - radius);
    bottom = Math.max(bottom, y + radius);
    return { x, y };
  }

  const factors = graph.factors.map(factor => {
    const color = factor.color ?? ink;
    const radius = factor.label ? labelRadius(factor.label, 11) : 4;
    const center = svgPoint(factor, radius);
    const group = append(markers, "g", { transform: `translate(${center.x} ${center.y})` });
    group.setAttribute("data-factor", factor.id);
    append(group, "title").textContent = `Factor ${factor.label || factor.id} (${factor.variables.join(", ")})`;
    const lines = factor.variables.map(id => {
      const v = positions.get(id);
      if (!v) {
        throw new RangeError(`Unknown factor endpoint: ${id}`);
      }
      const end = svgPoint(options.edgeEndpoint?.(factor, v) ?? v);
      return append(edges, "line", {
        x1: center.x, y1: center.y, x2: end.x, y2: end.y,
        stroke: color, "data-edge": "", "data-factor-id": factor.id, "data-variable-id": id
      });
    });
    const shape = glyph(group, radius, factor.shape === "square", factor.label ? "white" : color);
    if (factor.label) {
      shape.setAttribute("stroke", color);
      shape.setAttribute("stroke-width", "1.5");
      label(group, factor.label);
    }
    return { factor, group, lines, highlightable: options.isHighlightable?.(factor) ?? true };
  });

  const selectableIds = new Set<string>();
  const variables = graph.variables.map(v => {
    const radius = labelRadius(v.label, 16);
    const { x, y } = svgPoint(v, radius);
    const group = append(nodes, "g", { transform: `translate(${x} ${y})` });
    group.setAttribute("data-variable", v.id);
    group.setAttribute("aria-label", `${v.known ? "Known variable" : "Variable"} ${v.label}`);
    const shape = glyph(group, radius, v.known, "white");
    shape.setAttribute("stroke", v.color ?? ink);
    const text = label(group, v.label);

    function activate() {
      setSelection(v.id);
      options.onSelect?.(v.id);
    }
    if (options.isSelectable?.(v) ?? true) {
      selectableIds.add(v.id);
      group.setAttribute("role", "button");
      group.setAttribute("tabindex", "0");
      group.style.cursor = "pointer";
      group.addEventListener("click", activate);
      group.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      });
    }
    return { v, group, shape, text };
  });

  function setSelection(id: string | null) {
    if (id !== null && !selectableIds.has(id)) {
      throw new RangeError(positions.has(id) ? `Variable is not selectable: ${id}` : `Unknown variable: ${id}`);
    }
    const neighbors = new Set<string>();
    for (const { factor, group, lines, highlightable } of factors) {
      const active = highlightable && id !== null && factor.variables.includes(id);
      const dim = highlightable && id !== null && !active;
      if (active) {
        for (const endpoint of factor.variables) neighbors.add(endpoint);
      }
      group.setAttribute("data-active", String(active));
      group.setAttribute("opacity", dim ? "0.45" : "1");
      for (const line of lines) {
        line.setAttribute("data-active", String(active));
        line.setAttribute("stroke-width", active ? "2.5" : "1.5");
        line.setAttribute("opacity", dim ? "0.3" : "1");
      }
    }
    for (const { v, group, shape, text } of variables) {
      const selected = v.id === id;
      const active = selected || neighbors.has(v.id);
      if (selectableIds.has(v.id)) group.setAttribute("aria-pressed", String(selected));
      group.setAttribute("data-active", String(active));
      shape.setAttribute("stroke-width", active ? "3" : "1.5");
      const normalFill = v.known ? "#edf2e8" : "white";
      shape.setAttribute("fill", selected ? ink : normalFill);
      text.setAttribute("fill", selected ? "white" : ink);
    }
  }

  // Include glyphs and focus outlines at the extremes, also for singleton or empty graphs.
  const padding = 6;
  const width = viewport?.width ?? (Math.max(0, right - left) + 2 * padding);
  const height = viewport?.height ?? (Math.max(0, bottom - top) + 2 * padding);
  const x = !viewport && Number.isFinite(left) ? left - padding : 0;
  const y = !viewport && Number.isFinite(top) ? top - padding : 0;
  svg.setAttribute("viewBox", `${x} ${y} ${width} ${height}`);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  setSelection(null);
  container.replaceChildren(svg);
  return { svg, setSelection };
}
