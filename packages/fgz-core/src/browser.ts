import type { FactorGraph, GraphFactor, GraphVariable } from "./factor-graph.js";

export { parseFgz } from "./parser.js";
export { toFactorGraph, type FactorGraph, type GraphVariable, type GraphFactor } from "./factor-graph.js";

const ink = "#243438";
const grid = 48;
// Classic TikZ dimensions, in SVG units at one grid step per centimeter.
const classicStroke = "#1f2933";
const classicFactor = "#111827";
const classicVariableRadius = grid * 0.4;
const classicFactorRadius = grid * 0.16;

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

function label(parent: Element, value: string, classic: boolean) {
  const text = append(parent, "text", { fill: ink, "dominant-baseline": "central" });
  const sub = trailingSubscript.exec(value);
  if (sub) {
    text.textContent = sub[1]!;
    if (classic) text.setAttribute("font-style", "italic");
    const script = append(text, "tspan", { "baseline-shift": "sub", "font-size": "72%" });
    if (classic) script.setAttribute("font-style", "normal");
    script.textContent = sub[2] ?? sub[3]!;
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

function mutedColor(color: string) {
  const muted = `color-mix(in srgb, ${color} 45%, white)`;
  return typeof CSS !== "undefined" && !CSS.supports("color", muted) ? color : muted;
}

type Position = Pick<GraphVariable, "x" | "y">;

type ArrowEndpoint = Position & { radius: number; square: boolean };

function drawArrow(group: SVGGElement, start: ArrowEndpoint, end: ArrowEndpoint, stroke: string) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return;

  const strokeWidth = 1.5; // classic 0.9pt stroke at 48 SVG units/cm
  const squareScale = distance / Math.max(Math.abs(dx), Math.abs(dy));
  const boundary = (node: ArrowEndpoint) => (node.radius + strokeWidth / 2) * (node.square ? squareScale : 1);

  // The classic 2.2 × 1.8 mm TikZ Stealth has a 1.3 mm stroked contour
  // with a 45° tip. Its miter projects beyond the tip by half a stroke / sin(22.5°).
  const halfAngle = Math.PI / 8;
  const tipOverhang = (strokeWidth / 2) / Math.sin(halfAngle);
  const from = boundary(start);
  const tip = distance - boundary(end) - tipOverhang;
  if (tip <= from) return;

  const headLength = Math.min(grid * 0.13, tip - from);
  const halfWidth = headLength * Math.tan(halfAngle);
  const base = tip - headLength;
  const notch = base + headLength / 3;
  const degrees = Math.atan2(dy, dx) * 180 / Math.PI;
  group.setAttribute("transform", `translate(${start.x} ${start.y}) rotate(${degrees})`);
  append(group, "line", { x1: from, x2: notch, stroke, "stroke-width": strokeWidth });
  append(group, "path", {
    d: `M ${tip} 0 L ${base} ${halfWidth} L ${notch} 0 L ${base} ${-halfWidth} Z`,
    fill: stroke, stroke, "stroke-width": strokeWidth, "stroke-miterlimit": 10
  });
}

/** Optional layout and selection policies for an embedded graph. */
export interface FactorGraphRenderOptions {
  /** Match classic fgz print colors, sizes and label styling. Defaults to the interactive palette. */
  presentation?: "interactive" | "classic";
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
  const classic = options.presentation === "classic";
  const stroke = classic ? classicStroke : ink;
  const variableRadius = (v: GraphVariable) => labelRadius(v.label, classic ? classicVariableRadius : 16);
  svg.setAttribute("role", "group");
  svg.setAttribute("aria-label", "Factor graph");
  svg.setAttribute("text-anchor", "middle");
  svg.setAttribute("font-family", classic ? "Cambria Math, Times New Roman, serif" : "ui-monospace, monospace");
  svg.setAttribute("font-size", classic ? "17" : "13");
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

  function variable(id: string) {
    const v = positions.get(id);
    if (!v) throw new RangeError(`Unknown variable endpoint: ${id}`);
    return v;
  }

  function arrowEndpoint(v: GraphVariable): ArrowEndpoint {
    return { ...svgPoint(v), radius: variableRadius(v), square: v.known };
  }

  const arrows = graph.variables.flatMap(child => (child.parents ?? []).map(id => {
    const group = append(edges, "g", { "data-parent": id, "data-child": child.id });
    drawArrow(group, arrowEndpoint(variable(id)), arrowEndpoint(child), stroke);
    return { parent: id, child: child.id, group };
  }));

  const mutedInk = mutedColor(ink);
  const factors = graph.factors.map(factor => {
    const color = factor.color ?? stroke;
    const radius = factor.label ? labelRadius(factor.label, 11) : (classic ? classicFactorRadius : 4);
    const center = svgPoint(factor, radius);
    const group = append(markers, "g", { transform: `translate(${center.x} ${center.y})` });
    group.setAttribute("data-factor", factor.id);
    append(group, "title").textContent = `Factor ${factor.label || factor.id} (${factor.variables.join(", ")})`;
    const incidence = (id: string) => {
      const v = variable(id);
      return svgPoint(options.edgeEndpoint?.(factor, v) ?? v);
    };
    const lines: SVGElement[] = [];
    if (factor.bridgeControl) {
      const [first, second] = factor.variables;
      if (!first || !second) throw new RangeError("A bridge requires two endpoints");
      const start = incidence(first), end = incidence(second), control = svgPoint(factor.bridgeControl);
      lines.push(append(edges, "path", {
        d: `M ${start.x} ${start.y} C ${control.x} ${control.y} ${control.x} ${control.y} ${end.x} ${end.y}`,
        stroke: color, fill: "none", "data-edge": "", "data-factor-id": factor.id
      }));
    }
    for (const id of factor.variables.slice(factor.bridgeControl ? 2 : 0)) {
      const end = incidence(id);
      lines.push(append(edges, "line", {
        x1: center.x, y1: center.y, x2: end.x, y2: end.y,
        stroke: color, "data-edge": "", "data-factor-id": factor.id, "data-variable-id": id
      }));
    }
    const factorFill = classic ? (factor.color ?? classicFactor) : color;
    const shape = glyph(group, radius, factor.shape === "square", factor.label ? "white" : factorFill);
    const border = factor.label ? color : factorFill;
    const outlined = classic || !!factor.label;
    if (outlined) shape.setAttribute("stroke-width", factor.label ? "1.5" : "0.67");
    const text = factor.label ? label(group, factor.label, classic) : undefined;
    const mutedFill = mutedColor(factorFill);
    const mutedBorder = mutedColor(border);

    function paint(dimmed: boolean) {
      // Keep marker fills opaque so the edges drawn to their centers stay covered.
      if (text) text.setAttribute("fill", dimmed ? mutedInk : ink);
      else shape.setAttribute("fill", dimmed ? mutedFill : factorFill);
      if (outlined) shape.setAttribute("stroke", dimmed ? mutedBorder : border);
    }
    return { factor, group, lines, paint, highlightable: options.isHighlightable?.(factor) ?? true };
  });

  const selectableIds = new Set<string>();
  const variables = graph.variables.map(v => {
    const radius = variableRadius(v);
    const { x, y } = svgPoint(v, radius);
    const group = append(nodes, "g", { transform: `translate(${x} ${y})` });
    group.setAttribute("data-variable", v.id);
    group.setAttribute("aria-label", `${v.known ? "Known variable" : "Variable"} ${v.label}`);
    const shape = glyph(group, radius, v.known, "white");
    shape.setAttribute("stroke", classic ? classicStroke : (v.color ?? ink));
    const text = label(group, v.label, classic);

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
    for (const { parent, child, group } of arrows) {
      const active = id === parent || id === child;
      if (active) {
        neighbors.add(parent);
        neighbors.add(child);
      }
      group.setAttribute("data-active", String(active));
      group.setAttribute("opacity", id === null || active ? "1" : "0.3");
    }
    for (const { factor, group, lines, paint, highlightable } of factors) {
      const active = highlightable && id !== null && factor.variables.includes(id);
      const dim = highlightable && id !== null && !active;
      if (active) {
        for (const endpoint of factor.variables) neighbors.add(endpoint);
      }
      group.setAttribute("data-active", String(active));
      paint(dim);
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
      const normalFill = v.fill ?? (classic ? (v.color ?? "white") : (v.known ? "#edf2e8" : "white"));
      shape.setAttribute("fill", selected ? ink : normalFill);
      text.setAttribute("fill", selected ? "white" : (classic ? "black" : ink));
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
