import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseFgz, toTikz } from "../src/index.js";

const basicExample = readFileSync(new URL("../../../examples/basic.fgz", import.meta.url), "utf8");
const expectedTikz = readFileSync(new URL("./fixtures/basic.fgz.tex", import.meta.url), "utf8");

describe("toTikz", () => {
  it("matches the golden output", () => {
    const tikz = toTikz(parseFgz(basicExample));
    expect(tikz).toBe(expectedTikz);
  });

  it("infers the midpoint for binary factors without an authored position", () => {
    const tikz = toTikz(
      parseFgz(`fgz 1
variable x (0, 0)
variable y (2, 0)
factor {x, y}
`)
    );

    expect(tikz).toContain("\\fgzFactor{fgz_f1}{1}{0}");
  });

  it("infers the midpoint from the first two variables for higher-arity factors", () => {
    const tikz = toTikz(
      parseFgz(`fgz 1
variable a (0, 0)
variable b (2, 0)
variable c (4, 2)
factor {a, b, c}
`)
    );

    expect(tikz).toContain("\\fgzFactor{fgz_f1}{1}{0}");
    expect(tikz).toContain("\\fgzEdgeU{fgz_f1}{fgz_a}");
    expect(tikz).toContain("\\fgzEdgeU{fgz_f1}{fgz_b}");
    expect(tikz).toContain("\\fgzEdgeU{fgz_f1}{fgz_c}");
  });

  it("emits color-aware TikZ macros when colors are provided", () => {
    const tikz = toTikz(
      parseFgz(`fgz 1
variable x_1 (0, 0) color=gray!30
variable x_2 (2, 0)
node l_1 {x_1} (1, 1) color=gray!20
factor {x_1, x_2} color=red
`)
    );

    expect(tikz).toContain("\\fgzVarOpts{fgz_x_1}{0}{0}{$x_1$}{, fill=gray!30}");
    expect(tikz).toContain("\\fgzVarOpts{fgz_l_1}{1}{1}{$l_1$}{, fill=gray!20}");
    expect(tikz).toContain("\\fgzFactorColor{fgz_f1}{1}{0}{red}");
    expect(tikz).toContain("\\fgzEdgeUColor{fgz_f1}{fgz_x_1}{red}");
  });

  it("draws a single bridged factor edge when an offset is provided", () => {
    const tikz = toTikz(
      parseFgz(`fgz 1
variable x_1 (0, 0)
variable x_2 (2, 0)
factor {x_1, x_2} offset=(0,-0.4) color=red
`)
    );

    expect(tikz).toContain("\\fgzFactorColor{fgz_f1}{1}{-0.4}{red}");
    expect(tikz).toContain("\\fgzBridgeUColor{fgz_x_1}{1}{-0.5333333333333333}{fgz_x_2}{red}");
    expect(tikz).not.toContain("\\fgzEdgeUColor{fgz_f1}{fgz_x_1}{red}");
    expect(tikz).not.toContain("\\fgzEdgeUColor{fgz_f1}{fgz_x_2}{red}");
  });

  it("draws a single bridged override for undirected factor curves", () => {
    const tikz = toTikz(
      parseFgz(`fgz 1
variable x_1 (0, 0)
variable x_2 (2, 0)
factor {x_1, x_2}
curve x_1 -- x_2 via (1, 1)
`)
    );

    expect(tikz).toContain("\\fgzBridgeU{fgz_x_1}{1}{1}{fgz_x_2}");
    expect(tikz).not.toContain("\\fgzEdgeU{fgz_f1}{fgz_x_1}");
    expect(tikz).not.toContain("\\fgzEdgeU{fgz_f1}{fgz_x_2}");
  });

  it("emits per-document style setup macros", () => {
    const tikz = toTikz(
      parseFgz(`fgz 1
style node_size=9mm factor_size=4mm label_sep=0.4pt label_font=footnotesize
variable x (0, 0)
`)
    );

    expect(tikz).toContain("\\fgzsettheme{classic}\n\\fgzsetnodesize{9mm}\n\\fgzsetfactorsize{4mm}\n\\fgzsetlabelsep{0.4pt}\n\\fgzsetlabelfont{\\footnotesize}");
  });

  it("emits labeled dashed overrides for implied Bayes-net edges", () => {
    const tikz = toTikz(
      parseFgz(`fgz 1
node x_1 {} (1, 0)
node x_0 {x_1} (0, 0)
edge x_1 -> x_0 style=dashed label=0 label_side=left label_pos=0.3
`)
    );

    expect(tikz).toContain("\\fgzEdgeDOptsLabel{fgz_x_1}{fgz_x_0}{, dashed}{0}{left}{0.3}");
  });

  it("emits node option overrides for per-node size and font", () => {
    const tikz = toTikz(
      parseFgz(`fgz 1
node x {} (0, 0) size=16mm font=scriptsize
`)
    );

    expect(tikz).toContain("\\fgzVarOpts{fgz_x}{0}{0}{$x$}{, minimum size=16mm, font=\\scriptsize}");
  });

  it("emits text, line, and box annotations", () => {
    const tikz = toTikz(
      parseFgz(`fgz 1
t = k-1
text t (0, 1) font=small
line (1, 0) (1, 2) style=dashed
box (2, 0) (4, 3) color=black!50
`)
    );

    expect(tikz).toContain("\\fgzTextOpts{0}{1}{$k-1$}{, font=\\small}");
    expect(tikz).toContain("\\fgzLineOpts{1}{0}{1}{2}{, dashed}");
    expect(tikz).toContain("\\fgzBoxOpts{2}{0}{4}{3}{, draw=black!50}");
  });
});
