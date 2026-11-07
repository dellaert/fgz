import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { parseFgz, toTikz } from "../../fgz-core/src/index.js";
import { renderInteractiveSvg, renderTikzToSvg } from "../src/svg.js";

describe.sequential("renderTikzToSvg", () => {
  it(
    "renders a basic fgz diagram to SVG",
    { timeout: 60_000 },
    async () => {
      const tikz = toTikz(
        parseFgz(`fgz 1
variable x_0 (0, 0)
variable x_1 (2, 0)
factor {x_0, x_1}
`)
      );

      const svg = await renderTikzToSvg(tikz);

      expect(svg).toContain("<svg");
      expect(svg).toContain("viewBox=");
      expect(svg).toContain("<path");
      expect(svg).not.toContain("\\begin{tikzpicture}");
    }
  );

  it(
    "renders with an explicit TeX/TikZ preamble fragment when provided",
    { timeout: 60_000 },
    async () => {
      const tikz = toTikz(
        parseFgz(`fgz 1
t = \\twist
variable t (0, 0)
`)
      );

      const svg = await renderTikzToSvg(tikz, {
        preambleSource: "\\newcommand{\\twist}{\\mathcal{V}}"
      });

      expect(svg).toContain("<svg");
      expect(svg).toContain("viewBox=");
    }
  );

  it(
    "inlines browser font CSS instead of depending on external imports",
    { timeout: 60_000 },
    async () => {
      const tikz = toTikz(
        parseFgz(`fgz 1
variable x_0 (0, 0)
`)
      );

      const svg = await renderTikzToSvg(tikz);

      expect(svg).toContain("@font-face");
      expect(svg).toContain("data:font/ttf;base64,");
      expect(svg).not.toContain("@import url(");
    }
  );

  it("labels TikZ glyphs and their background edges with the original graph IDs", { timeout: 60_000 }, async () => {
    const doc = parseFgz(String.raw`fgz 1
x&b = x_0
variable x&b (0, 0)
variable x_{t+1} (3, 0)
factor {x&b, x_{t+1}} offset=(0,-0.5)
factor {x&b} (-1, 0)
node y {x_{t+1}} (3, 3)
edge x_{t+1} -> y style=dashed label=1
`);
    const svg = await renderInteractiveSvg(doc);
    const elements = new JSDOM(svg, { contentType: "image/svg+xml" }).window.document;
    const values = (attribute: string) => Array.from(elements.querySelectorAll(`[${attribute}]`), e => e.getAttribute(attribute));
    expect(values("data-variable")).toEqual(["x&b", "x_{t+1}", "y"]);
    expect(values("data-factor")).toEqual(["fgz_f1", "fgz_f2"]);
    expect(values("data-factor-id")).toEqual(["fgz_f1", "fgz_f2"]);
    expect(values("data-variable-id")).toEqual(["x&b"]);
    const arrow = elements.querySelector('[data-child="y"]')!;
    expect(arrow.getAttribute("data-parent")).toBe("x_{t+1}");
    expect(arrow.textContent).toBe("1");
    expect(arrow.querySelectorAll("path").length).toBeGreaterThan(1);
  });
});
