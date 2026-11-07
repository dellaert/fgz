import { FgzError } from "./error.js";
import { resolveFactorGeometry } from "./geometry.js";
import type { Document, FactorDecl, Point, VarDecl } from "./types.js";
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
}

/** A factor and the ordered IDs of its incident variables. */
export interface GraphFactor extends GraphNode {
  variables: string[];
  shape: "circle" | "square";
}

/** A JSON-serializable bipartite graph. IDs are scoped to each collection. */
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

function nodeStyle(statement: VarDecl | FactorDecl): Pick<GraphNode, "color"> {
  if (statement.size || statement.font) {
    unsupported(statement.size ? "size" : "font", statement.loc.line);
  }
  if (!statement.color) {
    return {};
  }
  if (!namedColors.has(statement.color)) {
    unsupported(`color "${statement.color}" (use a predefined color name)`, statement.loc.line);
  }
  return { color: statement.color };
}

/** Convert a straight-edge fgz factor graph into positioned, individually addressable nodes. */
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
      case "var": {
        const { name, pos } = statement;
        variables.push({
          id: name,
          label: doc.macros.get(name) ?? name,
          x: pos.x,
          y: pos.y,
          known: statement.kind === "known",
          ...nodeStyle(statement)
        });
        break;
      }
      case "factor": {
        if (statement.offset) {
          unsupported("offset", statement.loc.line);
        }
        const { point } = resolveFactorGeometry(statement, positions);
        const label = statement.label ?? "";
        factors.push({
          id: `fgz_f${factors.length + 1}`,
          label: doc.macros.get(label) ?? label,
          x: point.x,
          y: point.y,
          variables: [...statement.vars],
          shape: statement.shape ?? "circle",
          ...nodeStyle(statement)
        });
        break;
      }
      default:
        unsupported(statement.kind, statement.loc.line);
    }
  }
  return { variables, factors };
}
