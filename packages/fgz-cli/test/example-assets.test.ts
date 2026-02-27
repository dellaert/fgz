import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const examplesDir = new URL("../../../examples/", import.meta.url);

describe("example SVG assets", () => {
  it("includes rendered SVGs for the user guide examples", () => {
    const svgFiles = readdirSync(examplesDir)
      .filter((name) => name.endsWith(".svg"))
      .filter((name) => name.startsWith("guide-") || name.startsWith("slam-"))
      .sort();

    expect(svgFiles.length).toBeGreaterThan(0);

    for (const file of svgFiles) {
      const svg = readFileSync(new URL(file, examplesDir), "utf8");
      expect(svg.startsWith("<svg")).toBe(true);
      expect(svg.includes("viewBox=")).toBe(true);
    }
  });
});
