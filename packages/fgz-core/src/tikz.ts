import { assertValid } from "./validate.js";
import type { BNDecl, CurveDecl, Document, FactorDecl, Statement, Theme, VarDecl } from "./types.js";

interface FactorBinding {
  factor: FactorDecl;
  factorId: string;
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
  const macro = statement.kind === "known" || statement.kind === "known_node" ? "\\fgzKnown" : "\\fgzVar";
  return `${macro}{${symbolId(statement.name)}}{${formatCoordinate(statement.pos.rawX)}}{${formatCoordinate(
    statement.pos.rawY
  )}}{${labelFor(statement.name, doc)}}`;
}

function factorLine(statement: FactorDecl, factorIds: Map<FactorDecl, string>): string {
  const macro = statement.shape === "square" ? "\\fgzFactorSquare" : "\\fgzFactor";
  return `${macro}{${factorIds.get(statement) ?? "fgz_factor_missing"}}{${formatCoordinate(
    statement.pos.rawX
  )}}{${formatCoordinate(statement.pos.rawY)}}`;
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

  for (const statement of doc.statements) {
    switch (statement.kind) {
      case "var":
      case "known":
      case "node":
      case "known_node":
        lines.push(nodeLine(statement, doc));
        break;
      case "factor":
        lines.push(factorLine(statement, factorIds));
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
        edgeLines.push(`\\fgzEdgeU{${factorIds.get(statement) ?? "fgz_factor_missing"}}{${symbolId(name)}}`);
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
        edgeLines.push(
          `\\fgzCurveU{${binding.factorId}}{${symbolId(name)}}{${formatCoordinate(
            statement.control.rawX
          )}}{${formatCoordinate(statement.control.rawY)}}`
        );
      }
      continue;
    }

    if (statement.kind === "node" || statement.kind === "known_node") {
      for (const parent of statement.parents) {
        const override = curves.directed.get(`${parent}\u0000${statement.name}`);
        if (override) {
          edgeLines.push(
            `\\fgzCurveD{${symbolId(parent)}}{${symbolId(statement.name)}}{${formatCoordinate(
              override.control.rawX
            )}}{${formatCoordinate(override.control.rawY)}}`
          );
        } else {
          edgeLines.push(`\\fgzEdgeD{${symbolId(parent)}}{${symbolId(statement.name)}}`);
        }
      }
    }
  }

  lines.push(...edgeLines, "\\end{tikzpicture}");
  return `${lines.join("\n")}\n`;
}
