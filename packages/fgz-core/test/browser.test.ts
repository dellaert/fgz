// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { parseFgz, renderFactorGraph, toFactorGraph } from "../src/browser.js";

const graph = toFactorGraph(parseFgz(`fgz 1
x = X_{0}
known x (0, 2)
variable y (3, 0)
variable z (6, 0)
factor {x, y} shape=square color=teal label=f_1
factor {z} (6, 1)
`));

describe("renderFactorGraph", () => {
  it("renders variables, factor symbols, and incidence lines at the authored coordinates", () => {
    const { svg } = renderFactorGraph(document.createElement("div"), graph);
    const x = svg.querySelector('[data-variable="x"]')!;
    const f = svg.querySelector("[data-factor]")!;
    expect(x.getAttribute("transform")).toBe("translate(0 -96)");
    expect(x.querySelector("rect")).not.toBeNull();
    expect(x.querySelector("tspan")?.textContent).toBe("0");
    const square = f.querySelector("rect")!;
    expect(square.getAttribute("fill")).toBe("white");
    expect(square.getAttribute("stroke")).toBe("teal");
    expect(Number(square.getAttribute("width"))).toBeGreaterThan(20);
    expect(f.querySelector("text")?.getAttribute("y") ?? "0").toBe("0");
    expect(f.querySelector("tspan")?.textContent).toBe("1");
    expect(svg.querySelectorAll("[data-edge]")).toHaveLength(3);
    expect(svg.querySelector('[data-variable-id="x"]')?.getAttribute("stroke")).toBe("teal");
  });

  it("draws a bridge through its factor, with remaining incidences straight", () => {
    const graph = toFactorGraph(parseFgz(`fgz 1
variable a (0, 0)
variable b (4, 0)
variable c (2, 2)
factor {a, b, c} offset=(0,-0.75) color=red
`));
    const { svg, setSelection } = renderFactorGraph(document.createElement("div"), graph);
    const curve = svg.querySelector("path[data-edge]")!;
    expect(curve.getAttribute("d")).toBe("M 0 0 C 96 48 96 48 192 0");
    expect(curve.getAttribute("stroke")).toBe("red");
    expect(svg.querySelector("[data-factor]")?.getAttribute("transform")).toBe("translate(96 36)");
    expect(svg.querySelectorAll("line[data-edge]")).toHaveLength(1);
    expect(svg.querySelector("line[data-edge]")?.getAttribute("data-variable-id")).toBe("c");
    setSelection("b");
    expect(curve.getAttribute("data-active")).toBe("true");
  });

  it("clips parent arrows at the child and restores the authored classic node fill", () => {
    const graph = toFactorGraph(parseFgz(`fgz 1
variable x_1 (0, 0)
node x_2 {x_1} (2, 0) color=gray!25
factor {x_1} (0, 1)
`));
    const { svg, setSelection } = renderFactorGraph(document.createElement("div"), graph, { presentation: "classic" });
    const circle = svg.querySelector('[data-variable="x_2"] circle')!;
    expect(Number(circle.getAttribute("r"))).toBeCloseTo(19.2);
    expect(circle.getAttribute("fill")).toBe(graph.variables[1]!.fill);
    expect(circle.getAttribute("stroke")).toBe("#1f2933");
    expect(svg.querySelector("[data-factor] circle")?.getAttribute("r")).toBe("7.68");
    expect(svg.querySelector("[data-factor] circle")?.getAttribute("fill")).toBe("#111827");
    const arrow = svg.querySelector('[data-parent="x_1"][data-child="x_2"]')!;
    const contour = arrow.querySelector("path")!.getAttribute("d")!.split(" ");
    const tip = Number(contour[1]), notch = Number(contour[7]);
    // The visible miter tip meets the outside of the child stroke.
    expect(tip + 0.75 / Math.sin(Math.PI / 8)).toBeCloseTo(96 - 19.2 - 0.75);
    expect(Number(arrow.querySelector("line")!.getAttribute("x2"))).toBe(notch);
    expect(arrow.getAttribute("transform")).toBe("translate(0 0) rotate(0)");
    setSelection("x_2");
    expect(arrow.getAttribute("data-active")).toBe("true");
    setSelection(null);
    expect(circle.getAttribute("fill")).toBe(graph.variables[1]!.fill);
  });

  it("omits the arrow glyph when parent and child circles coincide or overlap", () => {
    const graph = toFactorGraph(parseFgz(`fgz 1
variable a (0, 0)
node b {a} (0, 0)
node c {a} (0.5, 0)
`));
    const { svg } = renderFactorGraph(document.createElement("div"), graph);
    for (const id of ["b", "c"]) {
      expect(svg.querySelector(`[data-parent="a"][data-child="${id}"]`)?.childElementCount).toBe(0);
    }
  });

  it("synchronizes user and host selection and keeps simultaneous views independent", () => {
    const onSelect = vi.fn();
    const { svg, setSelection } = renderFactorGraph(document.createElement("div"), graph, { onSelect });
    const other = renderFactorGraph(document.createElement("div"), graph);
    const x = svg.querySelector('[data-variable="x"]')!;
    const y = svg.querySelector('[data-variable="y"]')!;
    const z = svg.querySelector('[data-variable="z"]')!;
    const click = new MouseEvent("click", { bubbles: true });
    x.querySelector("text")!.dispatchEvent(click);
    expect(onSelect).toHaveBeenLastCalledWith("x");
    expect(x.getAttribute("aria-pressed")).toBe("true");
    expect(y.getAttribute("data-active")).toBe("true");
    expect(y.getAttribute("aria-pressed")).toBe("false");
    expect(z.getAttribute("data-active")).toBe("false");
    expect(svg.querySelectorAll('[data-factor][data-active="true"]')).toHaveLength(1);
    expect(svg.querySelectorAll('[data-edge][data-active="true"]')).toHaveLength(2);
    const square = svg.querySelector("[data-factor] rect")!;
    const dot = svg.querySelector("[data-factor] circle")!;
    expect(dot.getAttribute("fill")).toBe("color-mix(in srgb, #243438 45%, white)");

    for (const key of ["Enter", " "]) {
      const event = new KeyboardEvent("keydown", { key, cancelable: true });
      z.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      expect(onSelect).toHaveBeenLastCalledWith("z");
      expect(z.getAttribute("aria-pressed")).toBe("true");
      expect(svg.querySelectorAll('[data-edge][data-active="true"]')).toHaveLength(1);
      expect(square.getAttribute("fill")).toBe("white");
      expect(square.getAttribute("stroke")).toBe("color-mix(in srgb, teal 45%, white)");
      expect(dot.getAttribute("fill")).toBe("#243438");
    }
    setSelection("y");
    expect(y.getAttribute("aria-pressed")).toBe("true");
    expect(other.svg.querySelector('[aria-pressed="true"]')).toBeNull();
    expect(() => setSelection("missing")).toThrow(RangeError);
    setSelection(null);
    expect(svg.querySelector('[data-active="true"]')).toBeNull();
    expect(square.getAttribute("stroke")).toBe("teal");
    expect(dot.getAttribute("fill")).toBe("#243438");
    expect(onSelect).toHaveBeenCalledTimes(3);
  });

  it("treats arbitrary labels as text and supports an empty graph", () => {
    const container = document.createElement("div");
    const suspicious = '<image href="https://example.com/tracker"/>';
    const { svg } = renderFactorGraph(container, {
      variables: [{ id: 'x"]', label: suspicious, x: 0, y: 0, known: false }], factors: []
    });
    expect(svg.querySelector("text")?.textContent).toBe(suspicious);
    expect(svg.querySelector("image")).toBeNull();
    const empty = renderFactorGraph(container, { variables: [], factors: [] });
    expect(container.childNodes).toHaveLength(1);
    expect(empty.svg.getAttribute("viewBox")).not.toMatch(/NaN|Infinity/);
  });

  it("keeps a scrollable SVG layout and connects each observation at its specified endpoints", () => {
    const graph = toFactorGraph(parseFgz(`fgz 1
variable pose (32, 64)
variable stance (90, 175)
factor {pose, stance} (61, 121) shape=square
factor {pose} (32, 28)
`));
    const { svg } = renderFactorGraph(document.createElement("div"), graph, {
      viewport: { width: 1190, height: 320 },
      edgeEndpoint: (factor, variable) => factor.variables.length === 2
        ? { x: variable.x, y: variable.y + (variable.id === "pose" ? 16 : -13) }
        : undefined
    });
    expect(svg.getAttribute("viewBox")).toBe("0 0 1190 320");
    expect(svg.getAttribute("width")).toBe("1190");
    expect(svg.getAttribute("height")).toBe("320");
    expect(svg.style.maxWidth).toBe("");
    expect(svg.querySelector("[data-variable]")?.getAttribute("transform")).toBe("translate(32 64)");
    const lines = Array.from(svg.querySelectorAll("line"), line =>
      ["x1", "y1", "x2", "y2"].map(attr => Number(line.getAttribute(attr)))
    );
    expect(lines).toEqual([[61, 121, 32, 80], [61, 121, 90, 162], [32, 28, 32, 64]]);
  });

  it("includes custom endpoints in the bounds of an auto-fitted fgz graph", () => {
    const { svg } = renderFactorGraph(document.createElement("div"), graph, {
      edgeEndpoint: () => ({ x: -10, y: 10 })
    });
    expect(svg.querySelector("line")?.getAttribute("x2")).toBe("-480");
    expect(svg.querySelector("line")?.getAttribute("y2")).toBe("-480");
    expect(svg.getAttribute("viewBox")?.split(" ").slice(0, 2)).toEqual(["-486", "-486"]);
  });

  it("rejects an invalid viewport before replacing existing content", () => {
    const host = document.createElement("div");
    host.textContent = "original";
    for (const width of [0, -1, NaN, Infinity]) {
      expect(() => renderFactorGraph(host, graph, { viewport: { width, height: 320 } })).toThrow(RangeError);
    }
    expect(host.textContent).toBe("original");
  });

  it("keeps passive neighbors out of the tab order and highlights only eligible factors", () => {
    const contactGraph = toFactorGraph(parseFgz(`fgz 1
variable x0 (0, 0)
variable x1 (2, 0)
variable stance (1, -2)
factor {x0, stance} label=observation
factor {x1, stance} label=observation
factor {x0, x1} label=motion
`));
    const onSelect = vi.fn();
    const { svg, setSelection } = renderFactorGraph(document.createElement("div"), contactGraph, {
      onSelect,
      isSelectable: v => v.id !== "stance",
      isHighlightable: f => f.label === "observation"
    });
    const x0 = svg.querySelector('[data-variable="x0"]')!;
    const x1 = svg.querySelector('[data-variable="x1"]')!;
    const stance = svg.querySelector('[data-variable="stance"]')!;
    const factors = svg.querySelectorAll("[data-factor]");
    const first = factors.item(0), second = factors.item(1), motion = factors.item(2);
    expect(svg.querySelectorAll('[role="button"][tabindex="0"]')).toHaveLength(2);
    for (const attribute of ["role", "tabindex", "aria-pressed"]) {
      expect(stance.hasAttribute(attribute)).toBe(false);
    }
    stance.dispatchEvent(new MouseEvent("click"));
    for (const key of ["Enter", " "]) {
      const event = new KeyboardEvent("keydown", { key, cancelable: true });
      stance.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }
    expect(onSelect).not.toHaveBeenCalled();
    expect(() => setSelection("stance")).toThrow(RangeError);

    x0.dispatchEvent(new MouseEvent("click"));
    expect(onSelect).toHaveBeenCalledWith("x0");
    expect(stance.getAttribute("data-active")).toBe("true");
    expect(x1.getAttribute("data-active")).toBe("false");
    expect(first.getAttribute("data-active")).toBe("true");
    expect(second.hasAttribute("opacity")).toBe(false);
    expect(second.querySelector("circle")?.getAttribute("fill")).toBe("white");
    expect(second.querySelector("text")?.getAttribute("fill")).toBe("color-mix(in srgb, #243438 45%, white)");
    expect(motion.getAttribute("data-active")).toBe("false");
    expect(motion.querySelector("text")?.getAttribute("fill")).toBe("#243438");
    const dimmedId = second.getAttribute("data-factor");
    for (const edge of svg.querySelectorAll(`[data-factor-id="${dimmedId}"]`)) {
      expect(edge.getAttribute("opacity")).toBe("0.3");
    }
    const motionId = motion.getAttribute("data-factor");
    for (const edge of svg.querySelectorAll(`[data-factor-id="${motionId}"]`)) {
      expect(edge.getAttribute("data-active")).toBe("false");
      expect(edge.getAttribute("opacity")).toBe("1");
      expect(edge.getAttribute("stroke-width")).toBe("1.5");
    }

    setSelection("x1");
    expect(first.getAttribute("data-active")).toBe("false");
    expect(second.getAttribute("data-active")).toBe("true");
    expect(stance.hasAttribute("aria-pressed")).toBe(false);
    setSelection(null);
    expect(svg.querySelector('[data-active="true"]')).toBeNull();
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
