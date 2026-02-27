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

    expect(tikz).toContain("\\fgzVarFill{fgz_x_1}{0}{0}{$x_1$}{gray!30}");
    expect(tikz).toContain("\\fgzVarFill{fgz_l_1}{1}{1}{$l_1$}{gray!20}");
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
});
