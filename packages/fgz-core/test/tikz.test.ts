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
});
