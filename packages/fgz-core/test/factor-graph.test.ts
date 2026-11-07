import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseFgz, toFactorGraph } from "../src/index.js";

const graph = (source: string) => toFactorGraph(parseFgz(`fgz 1\n${source}`));

describe("toFactorGraph", () => {
  it("resolves labels, knowns, connectivity, and authored positions", () => {
    expect(graph(`q = q_{t+1}
u = u_t
known z (-2, 4) color=green
variable q (6, 1)
factor {q} (6, -2) shape=square label=u color=red
factor {q, z}`)).toEqual({
      variables: [
        { id: "z", label: "z", x: -2, y: 4, known: true, color: "green" },
        { id: "q", label: "q_{t+1}", x: 6, y: 1, known: false }
      ],
      factors: [
        { id: "fgz_f1", label: "u_t", x: 6, y: -2, variables: ["q"], shape: "square", color: "red" },
        { id: "fgz_f2", label: "", x: 2, y: 2.5, variables: ["q", "z"], shape: "circle" }
      ]
    });
  });

  it("uses the first two endpoints of a higher-arity factor, even when declared later", () => {
    const result = graph(`factor {fgz_f1, b, c}
variable b (2, 6)
variable fgz_f1 (0, 0)
variable c (20, -10)`);
    expect(result.factors[0]).toEqual({
      id: "fgz_f1", label: "", x: 1, y: 3, variables: ["fgz_f1", "b", "c"], shape: "circle"
    });
    expect(result.variables.map(node => node.id)).toEqual(["b", "fgz_f1", "c"]);
  });

  it("opens the original SLAM example with its explicit default theme", () => {
    const source = readFileSync(new URL("../../../examples/slam-original-factor-graph.fgz", import.meta.url), "utf8");
    const result = toFactorGraph(parseFgz(source));
    expect(result.variables.map(node => node.id)).toEqual(["x_1", "x_2", "x_3", "l_1", "l_2"]);
    expect(result.factors).toHaveLength(9);
    expect(result.factors[4]).toMatchObject({ variables: ["x_1", "l_1"], x: 1.75, y: 1.75 });
  });

  it.each([
    ["original-factor-graph", 9, 0], ["eliminate-l1", 7, 2], ["eliminate-l2", 6, 3],
    ["eliminate-x1", 3, 4], ["eliminate-x2", 2, 5], ["eliminate-x3", 0, 5]
  ] as const)("converts slam-%s with its factors and directed edges", (name, factorCount, arrowCount) => {
    const source = readFileSync(new URL(`../../../examples/slam-${name}.fgz`, import.meta.url), "utf8");
    const result = toFactorGraph(parseFgz(source));
    expect(result.variables).toHaveLength(5);
    expect(result.factors).toHaveLength(factorCount);
    expect(result.variables.flatMap(v => v.parents ?? [])).toHaveLength(arrowCount);
  });

  it("preserves parent order, known-node status, and xcolor gray tints", () => {
    const result = graph(`known_node child {root, x} (3, 2) color=gray!25
node root {} (0, 1)
variable x (1, 0)
factor {x} (0, 0) color=gray!55`);
    expect(result.variables[0]).toMatchObject({ known: true, parents: ["root", "x"], fill: "#e0e0e0" });
    expect(result.variables[1]?.parents).toEqual([]);
    expect(result.factors[0]?.color).toBe("#b9b9b9");
  });

  it.each([[0, "#ffffff"], [100, "#808080"]])("resolves gray!%i at the tint boundaries", (tint, color) => {
    expect(graph(`variable x (0, 0) color=gray!${tint}`).variables[0]?.color).toBe(color);
  });

  it("puts the offset factor at the midpoint of the cubic joining its first two variables", () => {
    const result = graph(`variable a (0, 0)
variable b (6, 3)
variable c (20, 20)
factor {a, b, c} offset=(1.5,-3)`);
    expect(result.factors[0]).toMatchObject({ x: 4.5, y: -1.5, bridgeControl: { x: 5, y: -2.5 } });
  });

  it("preserves core validation diagnostics", () => {
    expect(() => graph("variable x (0, 0)\nfactor {x, missing}")).toThrowError(/line 3:.*unknown symbol "missing"/);
  });

  it.each([
    ["style node_size=3mm", "style"],
    ["theme blog", "theme blog"],
    ["node y {x} (0, 1) color=gray!110", 'color "gray!110"'],
    ["box (0, 0) (1, 1)", "box"],
    ["plate (0, 0) (1, 1) label=N", "plate"],
    ["text title (0, 2)", "text"],
    ["variable y (1, 0) size=1mm", "size"],
    ["factor {x} (0, 1) font=small", "font"],
    ["factor {x} (0, 1) color=black!25", 'color "black!25"']
  ])("rejects %s at its source line", (source, feature) => {
    expect(() => graph(`variable x (0, 0)\n${source}`)).toThrowError(`line 3: interactive factor graphs do not support ${feature}`);
  });

  it.each([
    ["factor {a, b}\ncurve a -- b via (1,1)", "line 5: interactive factor graphs do not support curve"]
  ])("rejects curved geometry without losing its meaning", (source, error) => {
    expect(() => graph(`variable a (0, 0)\nvariable b (2, 0)\n${source}`)).toThrowError(error);
  });
});
