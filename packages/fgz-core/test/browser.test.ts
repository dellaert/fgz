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

    for (const key of ["Enter", " "]) {
      const event = new KeyboardEvent("keydown", { key, cancelable: true });
      z.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      expect(onSelect).toHaveBeenLastCalledWith("z");
      expect(z.getAttribute("aria-pressed")).toBe("true");
      expect(svg.querySelectorAll('[data-edge][data-active="true"]')).toHaveLength(1);
    }
    setSelection("y");
    expect(y.getAttribute("aria-pressed")).toBe("true");
    expect(other.svg.querySelector('[aria-pressed="true"]')).toBeNull();
    expect(() => setSelection("missing")).toThrow(RangeError);
    setSelection(null);
    expect(svg.querySelector('[data-active="true"]')).toBeNull();
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
});
