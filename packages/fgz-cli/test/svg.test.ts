import { describe, expect, it } from "vitest";
import { parseFgz, toTikz } from "../../fgz-core/src/index.js";
import { renderTikzToSvg } from "../src/svg.js";

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
    "renders with macro.tex-style preamble macros when provided",
    { timeout: 60_000 },
    async () => {
      const tikz = toTikz(
        parseFgz(`fgz 1
t = \\twist
variable t (0, 0)
`)
      );

      const svg = await renderTikzToSvg(tikz, {
        macroSource: "\\newcommand{\\twist}{\\mathcal{V}}"
      });

      expect(svg).toContain("<svg");
      expect(svg).toContain("viewBox=");
    }
  );
});
