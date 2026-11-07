import { FgzError } from "./error.js";
import type { FactorDecl, Point } from "./types.js";

export interface FactorGeometry {
  point: Point;
  bridgeControl?: Point;
}

/** Resolve an explicit position or the midpoint of the first two incident variables, plus any offset. */
export function resolveFactorGeometry(statement: FactorDecl, positions: ReadonlyMap<string, Point>): FactorGeometry {
  if (statement.pos) {
    return { point: statement.pos };
  }

  const [first, second] = statement.vars;
  if (!first || !second) {
    throw new FgzError("factor position inference requires at least two variables", statement.loc.line);
  }

  const left = positions.get(first);
  const right = positions.get(second);
  if (!left || !right) {
    throw new FgzError("factor position inference requires declared variable positions", statement.loc.line);
  }

  const x = (left.x + right.x) / 2 + (statement.offset?.x ?? 0);
  const y = (left.y + right.y) / 2 + (statement.offset?.y ?? 0);
  const point = { x, y, rawX: String(x), rawY: String(y) };
  if (!statement.offset) {
    return { point };
  }

  // With both cubic controls equal to C, B(1/2) = (left + 6C + right) / 8.
  const cx = (8 * x - left.x - right.x) / 6;
  const cy = (8 * y - left.y - right.y) / 6;
  return { point, bridgeControl: { x: cx, y: cy, rawX: String(cx), rawY: String(cy) } };
}
