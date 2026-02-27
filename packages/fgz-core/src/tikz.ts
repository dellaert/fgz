import { assertValid } from "./validate.js";
import { FgzError } from "./error.js";
import type { BNDecl, CurveDecl, Document, FactorDecl, Point, Statement, Theme, VarDecl } from "./types.js";

interface FactorBinding {
  factor: FactorDecl;
  factorId: string;
}

interface FactorGeometry {
  point: Point;
  bridgedPair?: [string, string];
}

interface BridgeSpec {
  left: string;
  right: string;
  control: Point;
  color: string | undefined;
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

function bridgeMacro(color: string | undefined): string {
  const head = "BridgeU";
  const colored = color ? "Color" : "";
  return `\\fgz${head}${colored}`;
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

function collectUndirectedOverridesByFactor(
  statements: Statement[],
  factorBindings: Map<string, FactorBinding>
): Map<FactorDecl, CurveDecl[]> {
  const overrides = new Map<FactorDecl, CurveDecl[]>();

  for (const statement of statements) {
    if (statement.kind !== "curve" || statement.directed) {
      continue;
    }

    const binding = factorBindings.get(factorCurveKey(statement.a, statement.b));
    if (!binding) {
      continue;
    }

    const current = overrides.get(binding.factor);
    if (current) {
      current.push(statement);
    } else {
      overrides.set(binding.factor, [statement]);
    }
  }

  return overrides;
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

function midpointPoint(left: Point, right: Point): Point {
  return {
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2,
    rawX: midpointRaw(left.x, right.x),
    rawY: midpointRaw(left.y, right.y)
  };
}

function offsetPoint(base: Point, offset: Point): Point {
  return {
    x: base.x + offset.x,
    y: base.y + offset.y,
    rawX: String(base.x + offset.x),
    rawY: String(base.y + offset.y)
  };
}

function controlFromFactorPoint(left: Point, factor: Point, right: Point): Point {
  return {
    x: (8 * factor.x - left.x - right.x) / 6,
    y: (8 * factor.y - left.y - right.y) / 6,
    rawX: String((8 * factor.x - left.x - right.x) / 6),
    rawY: String((8 * factor.y - left.y - right.y) / 6)
  };
}

function resolveFactorGeometry(statement: FactorDecl, positions: Map<string, Point>): FactorGeometry {
  if (statement.pos) {
    return { point: statement.pos };
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

  const midpoint = midpointPoint(left, right);
  if (!statement.offset) {
    return { point: midpoint };
  }

  return {
    point: offsetPoint(midpoint, statement.offset),
    bridgedPair: [first, second]
  };
}

function factorLine(statement: FactorDecl, factorIds: Map<FactorDecl, string>, positions: Map<string, Point>): string {
  const colored = statement.color ? "Color" : "";
  const macro = statement.shape === "square" ? `\\fgzFactorSquare${colored}` : `\\fgzFactor${colored}`;
  const point = resolveFactorGeometry(statement, positions).point;
  const base = `${macro}{${factorIds.get(statement) ?? "fgz_factor_missing"}}{${formatCoordinate(
    point.rawX
  )}}{${formatCoordinate(point.rawY)}}`;
  return statement.color ? `${base}{${statement.color}}` : base;
}

function bridgeLine(statement: FactorDecl, spec: BridgeSpec): string {
  const color = spec.color ?? statement.color;
  const macro = bridgeMacro(color);
  const base = `${macro}{${symbolId(spec.left)}}{${formatCoordinate(spec.control.rawX)}}{${formatCoordinate(
    spec.control.rawY
  )}}{${symbolId(spec.right)}}`;
  return color ? `${base}{${color}}` : base;
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
  const undirectedOverridesByFactor = collectUndirectedOverridesByFactor(doc.statements, factorBindings);
  const consumedFactorEdges = new Set<string>();
  const edgeLines: string[] = [];
  const positions = new Map<string, Point>();
  const renderedSymbols = new Set<string>();
  const factorGeometry = new Map<FactorDecl, FactorGeometry>();
  const bridgeSpecs = new Map<FactorDecl, BridgeSpec>();

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
        factorGeometry.set(statement, resolveFactorGeometry(statement, positions));
        break;
      default:
        break;
    }
  }

  for (const statement of doc.statements) {
    if (statement.kind !== "factor") {
      continue;
    }

    const geometry = factorGeometry.get(statement);
    const overrides = undirectedOverridesByFactor.get(statement) ?? [];
    const override = overrides[0];

    if (override) {
      bridgeSpecs.set(statement, {
        left: override.a,
        right: override.b,
        control: override.control,
        color: override.color ?? statement.color
      });
      lines.push(factorLine(statement, factorIds, positions));
      continue;
    }

    const pair = geometry?.bridgedPair;
    if (!pair) {
      lines.push(factorLine(statement, factorIds, positions));
      continue;
    }

    const left = positions.get(pair[0]);
    const right = positions.get(pair[1]);
    if (!left || !right || !geometry) {
      lines.push(factorLine(statement, factorIds, positions));
      continue;
    }

    bridgeSpecs.set(statement, {
      left: pair[0],
      right: pair[1],
      control: controlFromFactorPoint(left, geometry.point, right),
      color: statement.color
    });
    lines.push(factorLine(statement, factorIds, positions));
  }

  for (const statement of doc.statements) {
    if (statement.kind === "factor") {
      const factorId = factorIds.get(statement) ?? "fgz_factor_missing";
      const bridge = bridgeSpecs.get(statement);
      if (bridge) {
        edgeLines.push(bridgeLine(statement, bridge));
        consumedFactorEdges.add(`${factorId}\u0000${bridge.left}`);
        consumedFactorEdges.add(`${factorId}\u0000${bridge.right}`);
      }

      for (const name of statement.vars) {
        const edgeKey = `${factorId}\u0000${name}`;
        if (consumedFactorEdges.has(edgeKey)) {
          continue;
        }
        const macro = edgeMacro(false, statement.color, false);
        const base = `${macro}{${factorId}}{${symbolId(name)}}`;
        edgeLines.push(statement.color ? `${base}{${statement.color}}` : base);
      }
      continue;
    }

    if (statement.kind === "curve" && !statement.directed) {
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
