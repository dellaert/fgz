// @vitest-environment jsdom
import { expect, it } from "vitest";
import { parseFgz } from "../src/parser.js";
import { inspectGraph } from "../../../examples/browser/inspect-graph.js";

it("inspects the marked TikZ geometry without changing its authored colors", () => {
  const doc = parseFgz(`fgz 1
variable x (0, 0)
known y (1, 0)
variable z (2, 0)
factor {x, y}
node b {x} (3, 0)
`);
  document.body.innerHTML = `<svg>
    <g data-variable="x"><path fill="red"/></g><g data-variable="y"/><g data-variable="z"/><g data-variable="b"/>
    <g data-factor="fgz_f1"/><g data-factor-id="fgz_f1"/><g data-parent="x" data-child="b"/>
  </svg><output></output><button></button>`;
  const svg = document.querySelector("svg")!;
  const details = document.querySelector("output")!;
  const clear = document.querySelector("button")!;
  const x = svg.querySelector('[data-variable="x"]')!;
  const factor = svg.querySelector('[data-factor]')!;
  inspectGraph(svg, doc, details, clear);
  expect(x.getAttribute("aria-label")).toBe("Variable x");
  expect(clear.disabled).toBe(true);
  x.querySelector("path")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  expect(details.textContent).toContain("Parent of b");
  expect(details.textContent).toContain("Factor 1");
  expect(svg.querySelectorAll(".fgz-muted")).toHaveLength(1);
  factor.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
  expect(details.textContent).toBe("Factor 1 connects x, y.");
  expect(factor.getAttribute("aria-pressed")).toBe("true");
  expect(svg.querySelector("[data-parent]")!.classList.contains("fgz-muted")).toBe(true);
  expect(svg.querySelector("[data-factor-id]")!.classList.contains("fgz-muted")).toBe(false);
  clear.click();
  expect(svg.querySelectorAll(".fgz-muted")).toHaveLength(0);
  expect(x.querySelector("path")!.getAttribute("fill")).toBe("red");
  x.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
  x.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  expect(clear.disabled).toBe(true);
});
