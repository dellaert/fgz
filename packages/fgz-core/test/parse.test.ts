import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { formatFgz, parseFgz } from "../src/index.js";

const basicExample = readFileSync(new URL("../../../examples/basic.fgz", import.meta.url), "utf8");

describe("parseFgz", () => {
  it("parses the mixed example and preserves statement kinds", () => {
    const doc = parseFgz(basicExample);
    const counts = doc.statements.reduce<Record<string, number>>((acc, statement) => {
      acc[statement.kind] = (acc[statement.kind] ?? 0) + 1;
      return acc;
    }, {});

    expect(doc.version).toBe(1);
    expect(doc.theme).toBe("classic");
    expect(doc.macros.size).toBe(4);
    expect(counts).toEqual({
      theme: 1,
      macro: 4,
      known: 1,
      var: 1,
      factor: 1,
      known_node: 1,
      node: 1,
      curve: 1
    });
  });

  it("preserves binary factors without authored positions", () => {
    const doc = parseFgz(`fgz 1
variable x (0, 0)
variable y (2, 0)
factor {x, y}
`);

    expect(doc.statements[2]).toMatchObject({
      kind: "factor",
      vars: ["x", "y"]
    });
    expect(doc.statements[2] && "pos" in doc.statements[2] ? doc.statements[2].pos : undefined).toBeUndefined();
    expect(formatFgz(doc)).toContain("factor {x, y}\n");
  });

  it("parses color attributes on declarations", () => {
    const doc = parseFgz(`fgz 1
variable x_1 (0, 0) color=gray!30
node l_1 {x_1} (1, 1) color=gray!20
factor {x_1} color=red
curve x_1 -> l_1 via (0.5, 1.2) color=blue
`);

    expect(doc.statements[0]).toMatchObject({ kind: "var", name: "x_1", color: "gray!30" });
    expect(doc.statements[1]).toMatchObject({ kind: "node", name: "l_1", color: "gray!20" });
    expect(doc.statements[2]).toMatchObject({ kind: "factor", color: "red" });
    expect(doc.statements[3]).toMatchObject({ kind: "curve", color: "blue" });
  });
});
