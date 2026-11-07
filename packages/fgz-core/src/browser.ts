import type { FactorGraph } from "./factor-graph.js";

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

/**
 * Mount an interactive SVG in a host element, replacing its contents.
 * Click, Enter, and Space select a variable and notify the host.
 * The host can update or clear selection without triggering the callback.
 */
export function renderFactorGraph(
  container: Element,
  graph: FactorGraph,
  options: { onSelect?: (variableId: string) => void } = {}
) {
  const svg = container.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("role", "group");
  svg.setAttribute("aria-label", "Factor graph");
  svg.setAttribute("text-anchor", "middle");
  svg.setAttribute("font-family", "ui-monospace, monospace");
  svg.setAttribute("font-size", "13");
  svg.style.maxWidth = "100%";
  svg.style.height = "auto";

  const edges = append(svg, "g", { "aria-hidden": "true" });
  const markers = append(svg, "g");
  const nodes = append(svg, "g");
  const positions = new Map(graph.variables.map(v => [v.id, v]));
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  function place(layer: Element, node: { x: number; y: number }, radius: number) {
    const x = grid * node.x;
    const y = -grid * node.y;
    left = Math.min(left, x - radius);
    right = Math.max(right, x + radius);
    top = Math.min(top, y - radius);
    bottom = Math.max(bottom, y + radius);
    return append(layer, "g", { transform: `translate(${x} ${y})` });
  }

  const factors = graph.factors.map(factor => {
    const color = factor.color ?? ink;
    const radius = factor.label ? labelRadius(factor.label, 11) : 4;
    const group = place(markers, factor, radius);
    group.setAttribute("data-factor", factor.id);
    append(group, "title").textContent = `Factor ${factor.label || factor.id} (${factor.variables.join(", ")})`;
    const lines = factor.variables.map(id => {
      const v = positions.get(id);
      if (!v) {
        throw new RangeError(`Unknown factor endpoint: ${id}`);
      }
      return append(edges, "line", {
        x1: grid * factor.x, y1: -grid * factor.y, x2: grid * v.x, y2: -grid * v.y,
        stroke: color, "data-edge": "", "data-factor-id": factor.id, "data-variable-id": id
      });
    });
    const shape = glyph(group, radius, factor.shape === "square", factor.label ? "white" : color);
    if (factor.label) {
      shape.setAttribute("stroke", color);
      shape.setAttribute("stroke-width", "1.5");
      label(group, factor.label);
    }
    return { factor, group, lines };
  });

  const variables = graph.variables.map(v => {
    const radius = labelRadius(v.label, 16);
    const group = place(nodes, v, radius);
    group.setAttribute("data-variable", v.id);
    group.setAttribute("aria-label", `${v.known ? "Known variable" : "Variable"} ${v.label}`);
    group.setAttribute("role", "button");
    group.setAttribute("tabindex", "0");
    group.style.cursor = "pointer";
    const shape = glyph(group, radius, v.known, "white");
    shape.setAttribute("stroke", v.color ?? ink);
    const text = label(group, v.label);

    function activate() {
      setSelection(v.id);
      options.onSelect?.(v.id);
    }
    group.addEventListener("click", activate);
    group.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate();
      }
    });
    return { v, group, shape, text };
  });

  function setSelection(id: string | null) {
    if (id !== null && !positions.has(id)) {
      throw new RangeError(`Unknown variable: ${id}`);
    }
    const neighbors = new Set<string>();
    for (const { factor, group, lines } of factors) {
      const active = id !== null && factor.variables.includes(id);
      if (active) {
        for (const endpoint of factor.variables) neighbors.add(endpoint);
      }
      group.setAttribute("data-active", String(active));
      group.setAttribute("opacity", id === null || active ? "1" : "0.45");
      for (const line of lines) {
        line.setAttribute("data-active", String(active));
        line.setAttribute("stroke-width", active ? "2.5" : "1.5");
        line.setAttribute("opacity", id === null || active ? "1" : "0.3");
      }
    }
    for (const { v, group, shape, text } of variables) {
      const selected = v.id === id;
      const active = selected || neighbors.has(v.id);
      group.setAttribute("aria-pressed", String(selected));
      group.setAttribute("data-active", String(active));
      shape.setAttribute("stroke-width", active ? "3" : "1.5");
      const normalFill = v.known ? "#edf2e8" : "white";
      shape.setAttribute("fill", selected ? ink : normalFill);
      text.setAttribute("fill", selected ? "white" : ink);
    }
  }

  // Include glyphs and focus outlines at the extremes, also for singleton or empty graphs.
  const padding = 6;
  const width = Math.max(0, right - left) + 2 * padding;
  const height = Math.max(0, bottom - top) + 2 * padding;
  const x = Number.isFinite(left) ? left - padding : 0;
  const y = Number.isFinite(top) ? top - padding : 0;
  svg.setAttribute("viewBox", `${x} ${y} ${width} ${height}`);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  setSelection(null);
  container.replaceChildren(svg);
  return { svg, setSelection };
}
