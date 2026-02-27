import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FgzError, assertValid, parseFgz, validate } from "../src/index.js";

const basicExample = readFileSync(new URL("../../../examples/basic.fgz", import.meta.url), "utf8");

describe("validate", () => {
  it("accepts the mixed example", () => {
    const doc = parseFgz(basicExample);

    expect(validate(doc)).toEqual({ ok: true, errors: [] });
    expect(() => assertValid(doc)).not.toThrow();
  });

  it("rejects curve overrides that do not match an implied edge", () => {
    const doc = parseFgz(`fgz 1
variable x (0, 0)
variable y (2, 0)
factor {x, y} (1, 1)
curve y -> x via (1, 2)
`);

    const result = validate(doc);

    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatchObject({
      line: 5,
      message: 'curve override "y -> x" does not match any implied Bayes-net edge'
    });
    expect(() => assertValid(doc)).toThrow(FgzError);
  });

  it("accepts mixed diagrams where factor-graph variables are parents of nodes", () => {
    const doc = parseFgz(`fgz 1
variable x (0, 0)
node l {x} (1, 1)
`);

    expect(validate(doc)).toEqual({ ok: true, errors: [] });
  });

  it("rejects symbols declared as both variables and nodes", () => {
    const doc = parseFgz(`fgz 1
variable x (0, 0)
node x {} (0, 0)
`);

    const result = validate(doc);

    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatchObject({
      line: 3,
      message: 'symbol "x" cannot be declared as both variable and node'
    });
  });

  it("accepts missing factor positions for higher-arity factors", () => {
    const doc = parseFgz(`fgz 1
variable x (0, 0)
variable y (2, 0)
variable z (4, 0)
factor {x, y, z}
`);

    expect(validate(doc)).toEqual({ ok: true, errors: [] });
  });

  it("rejects combining factor offsets with explicit positions", () => {
    const doc = parseFgz(`fgz 1
variable x (0, 0)
variable y (2, 0)
factor {x, y} (1, 0) offset=(0,-0.3)
`);

    const result = validate(doc);

    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatchObject({
      line: 4,
      message: "factor offset cannot be combined with an explicit position"
    });
  });

  it("rejects directed edge overrides that do not match an implied Bayes-net edge", () => {
    const doc = parseFgz(`fgz 1
node x_1 {} (0, 0)
node x_0 {} (1, 0)
edge x_1 -> x_0 style=dashed label=0
`);

    const result = validate(doc);

    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatchObject({
      line: 4,
      message: 'edge override "x_1 -> x_0" does not match any implied Bayes-net edge'
    });
  });

  it("rejects invalid edge label positions", () => {
    const doc = parseFgz(`fgz 1
node x_1 {} (0, 0)
node x_0 {x_1} (1, 0)
edge x_1 -> x_0 label=0 label_pos=1.2
`);

    const result = validate(doc);

    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatchObject({
      line: 4,
      message: 'edge label_pos must be between 0 and 1, got "1.2"'
    });
  });

  it("rejects invalid annotation styles", () => {
    const doc = parseFgz(`fgz 1
line (0, 0) (0, 1) style=dotty
box (0, 0) (1, 1) style=wiggly
`);

    const result = validate(doc);

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      { line: 2, message: 'unknown line style "dotty"' },
      { line: 3, message: 'unknown box style "wiggly"' }
    ]);
  });
});
