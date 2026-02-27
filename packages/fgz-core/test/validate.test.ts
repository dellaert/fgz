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

  it("accepts missing factor positions for higher-arity factors", () => {
    const doc = parseFgz(`fgz 1
variable x (0, 0)
variable y (2, 0)
variable z (4, 0)
factor {x, y, z}
`);

    expect(validate(doc)).toEqual({ ok: true, errors: [] });
  });
});
