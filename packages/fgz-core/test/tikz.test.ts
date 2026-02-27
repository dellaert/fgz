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
});
