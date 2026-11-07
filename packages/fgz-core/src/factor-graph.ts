import { FgzError } from "./error.js";
import { resolveFactorGeometry } from "./geometry.js";
import type { BNDecl, Document, FactorDecl, Point, VarDecl } from "./types.js";
import { assertValid } from "./validate.js";

interface GraphNode {
  id: string;
  label: string;
  x: number;
  y: number;
  color?: string;
}

/** A positioned variable. toFactorGraph preserves its authored, y-up coordinates. */
export interface GraphVariable extends GraphNode {
  known: boolean;
  /** BN parents, ordered as declared. Present (and possibly empty) for Bayes-net nodes. */
  parents?: string[];
  /** Authored fill for a Bayes-net node. */
  fill?: string;
}

/** A factor and the ordered IDs of its incident variables. */
export interface GraphFactor extends GraphNode {
  variables: string[];
  shape: "circle" | "square";
  /** A cubic between the first two incident variables using this point for both controls. */
  bridgeControl?: { x: number; y: number };
}

/** A JSON-serializable factor graph, Bayes net, or mixed graph. IDs are scoped to each collection. */
export interface FactorGraph {
  variables: GraphVariable[];
  factors: GraphFactor[];
}

// Predefined xcolor names that SVG can also render without a preamble.
const namedColors = new Set([
  "black", "blue", "brown", "cyan", "darkgray", "gray", "green", "lightgray", "lime", "magenta",
  "olive", "orange", "pink", "purple", "red", "teal", "violet", "white", "yellow"
]);

function unsupported(feature: string, line: number): never {
  throw new FgzError(`interactive factor graphs do not support ${feature}`, line);
}

function nodeColor(statement: VarDecl | BNDecl | FactorDecl): string | undefined {
  if (statement.size || statement.font) {
    unsupported(statement.size ? "size" : "font", statement.loc.line);
  }
  if (!statement.color) {
    return undefined;
  }
  const tint = /^gray!(\d+(?:\.\d+)?)$/.exec(statement.color);
  if (tint && Number(tint[1]) <= 100) {
    // xcolor gray is 50% black; an omitted second color mixes it with white.
    const intensity = 1 - Number(tint[1]) / 200;
    const channel = Math.min(255, Math.floor(256 * intensity)).toString(16).padStart(2, "0");
    return `#${channel.repeat(3)}`;
  }
  if (!namedColors.has(statement.color)) {
    unsupported(`color "${statement.color}" (use a predefined color name or gray!percent)`, statement.loc.line);
  }
  return statement.color;
}

/** Convert an fgz graph into positioned, individually addressable nodes. */
export function toFactorGraph(doc: Document): FactorGraph {
  assertValid(doc);
  const positions = new Map<string, Point>();
  for (const statement of doc.statements) {
    if (statement.kind === "var" || statement.kind === "known") {
      positions.set(statement.name, statement.pos);
    }
  }

  const variables: GraphVariable[] = [];
  const factors: GraphFactor[] = [];
  for (const statement of doc.statements) {
    switch (statement.kind) {
      case "macro":
        break;
      case "theme":
        if (statement.theme !== "classic") {
          unsupported(`theme ${statement.theme}`, statement.loc.line);
        }
        break;
      case "known":
      case "var":
      case "known_node":
      case "node": {
        const { name, pos } = statement;
        const color = nodeColor(statement);
        const isBayesNode = "parents" in statement;
        variables.push({
          id: name,
          label: doc.macros.get(name) ?? name,
          x: pos.x,
          y: pos.y,
          known: statement.kind === "known" || statement.kind === "known_node",
          ...(isBayesNode && { parents: [...statement.parents] }),
          ...(color && (isBayesNode ? { fill: color } : { color }))
        });
        break;
      }
      case "factor": {
        const { point, bridgeControl } = resolveFactorGeometry(statement, positions);
        const label = statement.label ?? "";
        const color = nodeColor(statement);
        factors.push({
          id: `fgz_f${factors.length + 1}`,
          label: doc.macros.get(label) ?? label,
          x: point.x,
          y: point.y,
          variables: [...statement.vars],
          ...(bridgeControl && { bridgeControl: { x: bridgeControl.x, y: bridgeControl.y } }),
          shape: statement.shape ?? "circle",
          ...(color && { color })
        });
        break;
      }
      default:
        unsupported(statement.kind, statement.loc.line);
    }
  }
  return { variables, factors };
}
