import { assertValid } from "./validate.js";
import { FgzError } from "./error.js";
import type { BNDecl, CurveDecl, Document, FactorDecl, Point, Statement, Theme, VarDecl } from "./types.js";

interface FactorBinding {
  factor: FactorDecl;
  factorId: string;
}

function nodeMacro(statement: VarDecl | BNDecl): string {
  const colored = statement.color ? "Fill" : "";
  return statement.kind === "known" || statement.kind === "known_node"
    ? `\\fgzKnown${colored}`
    : `\\fgzVar${colored}`;
}

function edgeMacro(directed: boolean, color: string | undefined, curved: boolean): string {
  const head = curved ? "Curve" : "Edge";
  const direction = directed ? "D" : "U";
  const colored = color ? "Color" : "";
  return `\\fgz${head}${direction}${colored}`;
}

function symbolId(name: string): string {
  return `fgz_${name.replace(/[^A-Za-z0-9_]/g, "_")}`;
}

function factorCurveKey(a: string, b: string): string {
  return [a, b].sort().join("\u0000");
}

function labelFor(name: string, doc: Document): string {
  return `$${doc.macros.get(name) ?? name}$`;
}

function formatCoordinate(raw: string): string {
  return raw;
}

function themeFor(doc: Document): Theme {
  return doc.theme ?? "classic";
}

function collectFactorIds(statements: Statement[]): Map<FactorDecl, string> {
  const ids = new Map<FactorDecl, string>();
  let index = 0;

  for (const statement of statements) {
    if (statement.kind !== "factor") {
      continue;
    }
    index += 1;
    ids.set(statement, `fgz_f${index}`);
  }

  return ids;
}

function collectFactorCurveBindings(
  statements: Statement[],
  factorIds: Map<FactorDecl, string>
): Map<string, FactorBinding> {
  const bindings = new Map<string, FactorBinding>();

  for (const statement of statements) {
    if (statement.kind !== "factor") {
      continue;
    }

    for (let i = 0; i < statement.vars.length; i += 1) {
      for (let j = i + 1; j < statement.vars.length; j += 1) {
        const left = statement.vars[i];
        const right = statement.vars[j];
        if (!left || !right) {
          continue;
        }
        bindings.set(factorCurveKey(left, right), {
          factor: statement,
          factorId: factorIds.get(statement) ?? "fgz_factor_missing"
        });
      }
    }
  }

  return bindings;
}

function collectCurveOverrides(statements: Statement[]) {
  const directed = new Map<string, CurveDecl>();
  const undirected = new Map<string, CurveDecl>();

  for (const statement of statements) {
    if (statement.kind !== "curve") {
      continue;
    }

    if (statement.directed) {
      directed.set(`${statement.a}\u0000${statement.b}`, statement);
    } else {
      undirected.set(factorCurveKey(statement.a, statement.b), statement);
    }
  }

  return { directed, undirected };
}

function nodeLine(statement: VarDecl | BNDecl, doc: Document): string {
  const macro = nodeMacro(statement);
  const base = `${macro}{${symbolId(statement.name)}}{${formatCoordinate(statement.pos.rawX)}}{${formatCoordinate(
    statement.pos.rawY
  )}}{${labelFor(statement.name, doc)}}`;
  return statement.color ? `${base}{${statement.color}}` : base;
}

function midpointRaw(left: number, right: number): string {
  const value = (left + right) / 2;
  return String(value);
}

function resolveFactorPoint(statement: FactorDecl, positions: Map<string, Point>): Point {
  if (statement.pos) {
    return statement.pos;
  }

  const first = statement.vars[0];
  const second = statement.vars[1];
  if (!first || !second) {
    throw new FgzError("factor position inference requires at least two variables", statement.loc.line);
  }

  const left = positions.get(first);
  const right = positions.get(second);
  if (!left || !right) {
    throw new FgzError("factor position inference requires declared variable positions", statement.loc.line);
  }

  const rawX = midpointRaw(left.x, right.x);
  const rawY = midpointRaw(left.y, right.y);
  return {
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2,
    rawX,
    rawY
  };
}

function factorLine(statement: FactorDecl, factorIds: Map<FactorDecl, string>, positions: Map<string, Point>): string {
  const colored = statement.color ? "Color" : "";
  const macro = statement.shape === "square" ? `\\fgzFactorSquare${colored}` : `\\fgzFactor${colored}`;
  const point = resolveFactorPoint(statement, positions);
  const base = `${macro}{${factorIds.get(statement) ?? "fgz_factor_missing"}}{${formatCoordinate(
    point.rawX
  )}}{${formatCoordinate(point.rawY)}}`;
  return statement.color ? `${base}{${statement.color}}` : base;
}

/**
 * Convert a validated fgz document into a readable TikZ snippet.
 */
export function toTikz(doc: Document): string {
  assertValid(doc);

  const lines = ["\\begin{tikzpicture}[x=1cm,y=1cm]", `\\fgzsettheme{${themeFor(doc)}}`];
  const factorIds = collectFactorIds(doc.statements);
  const factorBindings = collectFactorCurveBindings(doc.statements, factorIds);
  const curves = collectCurveOverrides(doc.statements);
  const curvedFactorEdges = new Set<string>();
  const edgeLines: string[] = [];
  const positions = new Map<string, Point>();
  const renderedSymbols = new Set<string>();

  for (const statement of doc.statements) {
    switch (statement.kind) {
      case "var":
      case "known":
      case "node":
      case "known_node":
        if (!renderedSymbols.has(statement.name)) {
          lines.push(nodeLine(statement, doc));
          renderedSymbols.add(statement.name);
        }
        if (!positions.has(statement.name)) {
          positions.set(statement.name, statement.pos);
        }
        break;
      case "factor":
        lines.push(factorLine(statement, factorIds, positions));
        break;
      default:
        break;
    }
  }

  for (const statement of doc.statements) {
    if (statement.kind === "factor") {
      for (const name of statement.vars) {
        const edgeKey = `${factorIds.get(statement) ?? "fgz_factor_missing"}\u0000${name}`;
        if (curvedFactorEdges.has(edgeKey)) {
          continue;
        }
        const macro = edgeMacro(false, statement.color, false);
        const base = `${macro}{${factorIds.get(statement) ?? "fgz_factor_missing"}}{${symbolId(name)}}`;
        edgeLines.push(statement.color ? `${base}{${statement.color}}` : base);
      }
      continue;
    }

    if (statement.kind === "curve" && !statement.directed) {
      const binding = factorBindings.get(factorCurveKey(statement.a, statement.b));
      if (!binding) {
        continue;
      }

      for (const name of binding.factor.vars) {
        if (name !== statement.a && name !== statement.b) {
          continue;
        }
        const edgeKey = `${binding.factorId}\u0000${name}`;
        curvedFactorEdges.add(edgeKey);
        const color = statement.color ?? binding.factor.color;
        const macro = edgeMacro(false, color, true);
        const base = `${macro}{${binding.factorId}}{${symbolId(name)}}{${formatCoordinate(
          statement.control.rawX
        )}}{${formatCoordinate(statement.control.rawY)}}`;
        edgeLines.push(color ? `${base}{${color}}` : base);
      }
      continue;
    }

    if (statement.kind === "node" || statement.kind === "known_node") {
      for (const parent of statement.parents) {
        const override = curves.directed.get(`${parent}\u0000${statement.name}`);
        if (override) {
          const macro = edgeMacro(true, override.color, true);
          const base = `${macro}{${symbolId(parent)}}{${symbolId(statement.name)}}{${formatCoordinate(
            override.control.rawX
          )}}{${formatCoordinate(override.control.rawY)}}`;
          edgeLines.push(override.color ? `${base}{${override.color}}` : base);
        } else {
          edgeLines.push(`\\fgzEdgeD{${symbolId(parent)}}{${symbolId(statement.name)}}`);
        }
      }
    }
  }

  lines.push(...edgeLines, "\\end{tikzpicture}");
  return `${lines.join("\n")}\n`;
}
