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
factor {x_1, x_2} offset=(0,-0.4) color=red
curve x_1 -> l_1 via (0.5, 1.2) color=blue
`);

    expect(doc.statements[0]).toMatchObject({ kind: "var", name: "x_1", color: "gray!30" });
    expect(doc.statements[1]).toMatchObject({ kind: "node", name: "l_1", color: "gray!20" });
    expect(doc.statements[2]).toMatchObject({ kind: "factor", color: "red", offset: { x: 0, y: -0.4 } });
    expect(doc.statements[3]).toMatchObject({ kind: "curve", color: "blue" });
  });

  it("accepts direct LaTeX-style labels without macros", () => {
    const doc = parseFgz(`fgz 1
variable x_{t+1} (0, 0)
known b_{t+1} (1, -1)
factor {x_{t+1}, b_{t+1}}
`);

    expect(doc.statements[0]).toMatchObject({ kind: "var", name: "x_{t+1}" });
    expect(doc.statements[1]).toMatchObject({ kind: "known", name: "b_{t+1}" });
    expect(doc.statements[2]).toMatchObject({ kind: "factor", vars: ["x_{t+1}", "b_{t+1}"] });
    expect(formatFgz(doc)).toContain("variable x_{t+1} (0, 0)\n");
  });

  it("parses per-document style directives", () => {
    const doc = parseFgz(`fgz 1
style node_size=9mm factor_size=4mm label_sep=0.4pt label_font=footnotesize
variable x (0, 0)
`);

    expect(doc.statements[0]).toMatchObject({
      kind: "style",
      nodeSize: "9mm",
      factorSize: "4mm",
      labelSep: "0.4pt",
      labelFont: "footnotesize"
    });
    expect(formatFgz(doc)).toContain("style node_size=9mm factor_size=4mm label_sep=0.4pt label_font=footnotesize\n");
  });

  it("parses directed edge overrides with labels", () => {
    const doc = parseFgz(`fgz 1
node x_1 {} (0, 0)
node x_0 {x_1} (1, 0)
edge x_1 -> x_0 style=dashed label=0 label_side=left label_pos=0.3
`);

    expect(doc.statements[2]).toMatchObject({
      kind: "edge",
      a: "x_1",
      b: "x_0",
      style: "dashed",
      label: "0",
      labelSide: "left",
      labelPos: "0.3"
    });
    expect(formatFgz(doc)).toContain("edge x_1 -> x_0 style=dashed label=0 label_side=left label_pos=0.3\n");
  });

  it("parses per-node size and font overrides", () => {
    const doc = parseFgz(`fgz 1
node p {x} (0, 0) size=16mm font=scriptsize
`);

    expect(doc.statements[0]).toMatchObject({
      kind: "node",
      size: "16mm",
      font: "scriptsize"
    });
    expect(formatFgz(doc)).toContain("node p {x} (0, 0) size=16mm font=scriptsize\n");
  });

  it("parses text, line, and box annotations", () => {
    const doc = parseFgz(`fgz 1
t = k-1
text t (0, 1) font=small
line (1, 0) (1, 2) style=dashed
box (2, 0) (4, 3) color=black!50
`);

    expect(doc.statements[1]).toMatchObject({ kind: "text", name: "t", font: "small" });
    expect(doc.statements[2]).toMatchObject({ kind: "line", style: "dashed" });
    expect(doc.statements[3]).toMatchObject({ kind: "box", color: "black!50" });
    expect(formatFgz(doc)).toContain("text t (0, 1) font=small\n");
    expect(formatFgz(doc)).toContain("line (1, 0) (1, 2) style=dashed\n");
    expect(formatFgz(doc)).toContain("box (2, 0) (4, 3) color=black!50\n");
  });
});
