import { assertValid } from "./validate.js";
import { FgzError } from "./error.js";
import type {
  BNDecl,
  BoxDecl,
  CurveDecl,
  Document,
  EdgeDecl,
  FactorDecl,
  PlateDecl,
  Point,
  Statement,
  TextDecl,
  Theme,
  VarDecl
} from "./types.js";

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

interface DocumentStyle {
  nodeSize?: string;
  factorSize?: string;
  labelSep?: string;
  labelFont?: string;
}

interface DirectedEdgeStyle {
  style?: "solid" | "dashed";
  label?: string;
  labelSide?: "left" | "right";
  labelPos?: string;
}

/** Pick the base TikZ macro for a variable-like node. */
function nodeMacro(statement: VarDecl | BNDecl): string {
  const colored = statement.color ? "Fill" : "";
  return statement.kind === "known" || statement.kind === "known_node"
    ? `\\fgzKnown${colored}`
    : `\\fgzVar${colored}`;
}

/** Pick the edge macro family for directedness, curvature, and color. */
function edgeMacro(directed: boolean, color: string | undefined, curved: boolean): string {
  const head = curved ? "Curve" : "Edge";
  const direction = directed ? "D" : "U";
  const colored = color ? "Color" : "";
  return `\\fgz${head}${direction}${colored}`;
}

/** Pick the macro family used for bridged binary factor edges. */
function bridgeMacro(color: string | undefined): string {
  const head = "BridgeU";
  const colored = color ? "Color" : "";
  return `\\fgz${head}${colored}`;
}

/** Render a free-standing text annotation. */
function textLine(statement: TextDecl, doc: Document): string {
  const options: string[] = [];
  if (statement.color) {
    options.push(`text=${statement.color}`);
  }
  if (statement.font) {
    options.push(`font=${latexFont(statement.font)}`);
  }

  return options.length === 0
    ? `\\fgzText{${formatCoordinate(statement.pos.rawX)}}{${formatCoordinate(statement.pos.rawY)}}{${labelFor(
        statement.name,
        doc
      )}}`
    : `\\fgzTextOpts{${formatCoordinate(statement.pos.rawX)}}{${formatCoordinate(statement.pos.rawY)}}{${labelFor(
        statement.name,
        doc
      )}}{, ${options.join(", ")}}`;
}

/** Translate simple line styling into a TikZ option suffix. */
function linearOptionSuffix(style: "solid" | "dashed" | undefined, color: string | undefined): string {
  const options: string[] = [];
  if (style === "dashed") {
    options.push("dashed");
  }
  if (color) {
    options.push(`draw=${color}`);
  }
  return edgeOptionSuffix(options);
}

/** Render a box annotation as a TikZ macro call. */
function boxDeclLine(statement: BoxDecl): string {
  const options = linearOptionSuffix(statement.style, statement.color);
  return options === ""
    ? `\\fgzBox{${formatCoordinate(statement.from.rawX)}}{${formatCoordinate(statement.from.rawY)}}{${formatCoordinate(
        statement.to.rawX
      )}}{${formatCoordinate(statement.to.rawY)}}`
    : `\\fgzBoxOpts{${formatCoordinate(statement.from.rawX)}}{${formatCoordinate(
        statement.from.rawY
      )}}{${formatCoordinate(statement.to.rawX)}}{${formatCoordinate(statement.to.rawY)}}{${options}}`;
}

/** Render a plate outline as a TikZ macro call. */
function plateDeclLine(statement: PlateDecl): string {
  const options = statement.color ? edgeOptionSuffix([`draw=${statement.color}`]) : "";
  return options === ""
    ? `\\fgzPlate{${formatCoordinate(statement.from.rawX)}}{${formatCoordinate(statement.from.rawY)}}{${formatCoordinate(
        statement.to.rawX
      )}}{${formatCoordinate(statement.to.rawY)}}`
    : `\\fgzPlateOpts{${formatCoordinate(statement.from.rawX)}}{${formatCoordinate(
        statement.from.rawY
      )}}{${formatCoordinate(statement.to.rawX)}}{${formatCoordinate(statement.to.rawY)}}{${options}}`;
}

/** Join an option list into the shared macro suffix format. */
function edgeOptionSuffix(options: string[]): string {
  return options.length === 0 ? "" : `, ${options.join(", ")}`;
}

/** Convert an fgz symbol name into a TikZ-safe node id. */
function symbolId(name: string): string {
  return `fgz_${name.replace(/[^A-Za-z0-9_]/g, "_")}`;
}

/** Build an order-insensitive key for a factor-graph symbol pair. */
function factorCurveKey(a: string, b: string): string {
  return [a, b].sort().join("\u0000");
}

/** Resolve a symbol label using the document macro table when present. */
function labelFor(name: string, doc: Document): string {
  return `$${doc.macros.get(name) ?? name}$`;
}

/** Resolve an inline label token using the document macro table when present. */
function inlineLatexLabel(value: string, doc: Document): string {
  return `$${doc.macros.get(value) ?? value}$`;
}

/** Preserve an authored coordinate string exactly as emitted TikZ text. */
function formatCoordinate(raw: string): string {
  return raw;
}

/** Return the effective document theme, falling back to `classic`. */
function themeFor(doc: Document): Theme {
  return doc.theme ?? "classic";
}

/** Merge all document-level style statements into the effective render style. */
function collectDocumentStyle(statements: Statement[]): DocumentStyle {
  const style: DocumentStyle = {};

  for (const statement of statements) {
    if (statement.kind !== "style") {
      continue;
    }

    if (statement.nodeSize) {
      style.nodeSize = statement.nodeSize;
    }
    if (statement.factorSize) {
      style.factorSize = statement.factorSize;
    }
    if (statement.labelSep) {
      style.labelSep = statement.labelSep;
    }
    if (statement.labelFont) {
      style.labelFont = statement.labelFont;
    }
  }

  return style;
}

/** Normalize a font token into a TeX command. */
function latexFont(value: string): string {
  return value.startsWith("\\") ? value : `\\${value}`;
}

/** Emit document-level style setup macros. */
function styleLines(style: DocumentStyle): string[] {
  const lines: string[] = [];
  if (style.nodeSize) {
    lines.push(`\\fgzsetnodesize{${style.nodeSize}}`);
  }
  if (style.factorSize) {
    lines.push(`\\fgzsetfactorsize{${style.factorSize}}`);
  }
  if (style.labelSep) {
    lines.push(`\\fgzsetlabelsep{${style.labelSep}}`);
  }
  if (style.labelFont) {
    lines.push(`\\fgzsetlabelfont{${latexFont(style.labelFont)}}`);
  }
  return lines;
}

/** Compute the automatic top-right label placement used for plates. */
function plateLabelGeometry(statement: PlateDecl): { x: string; y: string; anchor: string } | undefined {
  if (!statement.label) {
    return undefined;
  }

  const insetX = 0.14;
  const insetY = 0.08;
  return { x: String(statement.to.x - insetX), y: String(statement.to.y - insetY), anchor: "north east" };
}

/** Render the label attached to a plate outline. */
function plateLabelLine(statement: PlateDecl, doc: Document): string | undefined {
  if (!statement.label) {
    return undefined;
  }

  const geometry = plateLabelGeometry(statement);
  if (!geometry) {
    return undefined;
  }

  const options = [`anchor=${geometry.anchor}`];
  if (statement.font) {
    options.push(`font=${latexFont(statement.font)}`);
  }

  return `\\fgzTextOpts{${geometry.x}}{${geometry.y}}{${inlineLatexLabel(statement.label, doc)}}{, ${options.join(", ")}}`;
}

/** Assign deterministic TikZ ids to factors in statement order. */
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

/** Map implied factor-graph pairs back to the factor that owns them. */
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

/** Split curve overrides into directed and undirected lookup maps. */
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

/** Collect directed edge-style overrides by parent-child key. */
function collectDirectedEdgeOverrides(statements: Statement[]): Map<string, EdgeDecl> {
  const directed = new Map<string, EdgeDecl>();

  for (const statement of statements) {
    if (statement.kind !== "edge") {
      continue;
    }

    directed.set(`${statement.a}\u0000${statement.b}`, statement);
  }

  return directed;
}

/** Group undirected curve overrides by the factor node they target. */
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

/** Render a variable-like node with any per-node overrides applied. */
function nodeLine(statement: VarDecl | BNDecl, doc: Document): string {
  const options: string[] = [];
  if (statement.color) {
    options.push(`fill=${statement.color}`);
  }
  if (statement.size) {
    options.push(`minimum size=${statement.size}`);
  }
  if (statement.font) {
    options.push(`font=${latexFont(statement.font)}`);
  }

  if (options.length > 0) {
    const macro = statement.kind === "known" || statement.kind === "known_node" ? "\\fgzKnownOpts" : "\\fgzVarOpts";
    return `${macro}{${symbolId(statement.name)}}{${formatCoordinate(statement.pos.rawX)}}{${formatCoordinate(
      statement.pos.rawY
    )}}{${labelFor(statement.name, doc)}}{, ${options.join(", ")}}`;
  }

  const macro = nodeMacro(statement);
  const base = `${macro}{${symbolId(statement.name)}}{${formatCoordinate(statement.pos.rawX)}}{${formatCoordinate(
    statement.pos.rawY
  )}}{${labelFor(statement.name, doc)}}`;
  return statement.color ? `${base}{${statement.color}}` : base;
}

/** Resolve the optional label rendered inside a factor node. */
function factorLabel(statement: FactorDecl, doc: Document): string {
  return statement.label ? inlineLatexLabel(statement.label, doc) : "";
}

/** Format the midpoint between two scalar coordinates. */
function midpointRaw(left: number, right: number): string {
  const value = (left + right) / 2;
  return String(value);
}

/** Compute the midpoint between two points while preserving readable coordinate text. */
function midpointPoint(left: Point, right: Point): Point {
  return {
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2,
    rawX: midpointRaw(left.x, right.x),
    rawY: midpointRaw(left.y, right.y)
  };
}

/** Apply an authored offset to an inferred factor position. */
function offsetPoint(base: Point, offset: Point): Point {
  return {
    x: base.x + offset.x,
    y: base.y + offset.y,
    rawX: String(base.x + offset.x),
    rawY: String(base.y + offset.y)
  };
}

/** Derive the cubic control point used for bridged binary factor edges. */
function controlFromFactorPoint(left: Point, factor: Point, right: Point): Point {
  return {
    x: (8 * factor.x - left.x - right.x) / 6,
    y: (8 * factor.y - left.y - right.y) / 6,
    rawX: String((8 * factor.x - left.x - right.x) / 6),
    rawY: String((8 * factor.y - left.y - right.y) / 6)
  };
}

/** Resolve the effective factor position from explicit coordinates or midpoint rules. */
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

/** Render a factor node, including labels and per-factor sizing overrides. */
function factorLine(
  statement: FactorDecl,
  factorIds: Map<FactorDecl, string>,
  positions: Map<string, Point>,
  doc: Document
): string {
  const point = resolveFactorGeometry(statement, positions).point;
  const options: string[] = [];
  if (statement.color) {
    options.push(`draw=${statement.color}`, `fill=${statement.color}`);
  }
  if (statement.size) {
    options.push(`minimum size=${statement.size}`);
  }
  if (statement.font) {
    options.push(`font=${latexFont(statement.font)}`);
  }

  const label = factorLabel(statement, doc);
  const macroBase =
    statement.shape === "square"
      ? options.length > 0 || label !== ""
        ? "\\fgzFactorSquareOpts"
        : "\\fgzFactorSquare"
      : options.length > 0 || label !== ""
        ? "\\fgzFactorOpts"
        : "\\fgzFactor";

  if (macroBase === "\\fgzFactorSquare" || macroBase === "\\fgzFactor") {
    return `${macroBase}{${factorIds.get(statement) ?? "fgz_factor_missing"}}{${formatCoordinate(point.rawX)}}{${formatCoordinate(
      point.rawY
    )}}`;
  }

  return `${macroBase}{${factorIds.get(statement) ?? "fgz_factor_missing"}}{${formatCoordinate(
    point.rawX
  )}}{${formatCoordinate(point.rawY)}}{${label}}{${edgeOptionSuffix(options)}}`;
}

/** Render a single curved bridge edge through an implied binary factor. */
function bridgeLine(statement: FactorDecl, spec: BridgeSpec): string {
  const color = spec.color ?? statement.color;
  const macro = bridgeMacro(color);
  const base = `${macro}{${symbolId(spec.left)}}{${formatCoordinate(spec.control.rawX)}}{${formatCoordinate(
    spec.control.rawY
  )}}{${symbolId(spec.right)}}`;
  return color ? `${base}{${color}}` : base;
}

/** Render a directed BN edge with optional curve, style, and label overrides. */
function directedEdgeLine(
  parent: string,
  child: string,
  curve: CurveDecl | undefined,
  edge: EdgeDecl | undefined
): string {
  const options: string[] = [];
  if (curve?.color) {
    options.push(`draw=${curve.color}`);
  }
  if (edge?.style === "dashed") {
    options.push("dashed");
  }

  const optionSuffix = edgeOptionSuffix(options);
  const label = edge?.label;
  const labelSide = edge?.labelSide ?? "left";
  const labelPos = edge?.labelPos ?? "0.5";

  if (curve) {
    if (label) {
      return `\\fgzCurveDOptsLabel{${symbolId(parent)}}{${symbolId(child)}}{${formatCoordinate(
        curve.control.rawX
      )}}{${formatCoordinate(curve.control.rawY)}}{${optionSuffix}}{${label}}{${labelSide}}{${labelPos}}`;
    }
    if (optionSuffix !== "") {
      return `\\fgzCurveDOpts{${symbolId(parent)}}{${symbolId(child)}}{${formatCoordinate(
        curve.control.rawX
      )}}{${formatCoordinate(curve.control.rawY)}}{${optionSuffix}}`;
    }
    return `\\fgzCurveD{${symbolId(parent)}}{${symbolId(child)}}{${formatCoordinate(curve.control.rawX)}}{${formatCoordinate(
      curve.control.rawY
    )}}`;
  }

  if (label) {
    return `\\fgzEdgeDOptsLabel{${symbolId(parent)}}{${symbolId(child)}}{${optionSuffix}}{${label}}{${labelSide}}{${labelPos}}`;
  }
  if (optionSuffix !== "") {
    return `\\fgzEdgeDOpts{${symbolId(parent)}}{${symbolId(child)}}{${optionSuffix}}`;
  }
  return `\\fgzEdgeD{${symbolId(parent)}}{${symbolId(child)}}`;
}

/**
 * Convert a validated fgz document into a readable TikZ snippet.
 */
export function toTikz(doc: Document): string {
  assertValid(doc);

  const lines = ["\\begin{tikzpicture}[x=1cm,y=1cm]", `\\fgzsettheme{${themeFor(doc)}}`];
  lines.push(...styleLines(collectDocumentStyle(doc.statements)));
  const factorIds = collectFactorIds(doc.statements);
  const factorBindings = collectFactorCurveBindings(doc.statements, factorIds);
  const curves = collectCurveOverrides(doc.statements);
  const directedEdges = collectDirectedEdgeOverrides(doc.statements);
  const undirectedOverridesByFactor = collectUndirectedOverridesByFactor(doc.statements, factorBindings);
  const consumedFactorEdges = new Set<string>();
  const edgeLines: string[] = [];
  const positions = new Map<string, Point>();
  const renderedSymbols = new Set<string>();
  const factorGeometry = new Map<FactorDecl, FactorGeometry>();
  const bridgeSpecs = new Map<FactorDecl, BridgeSpec>();

  // Pass 1 emits positioned nodes and annotations while collecting geometry needed for edges.
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
      case "text":
        lines.push(textLine(statement, doc));
        break;
      case "box":
        lines.push(boxDeclLine(statement));
        break;
      case "plate":
        lines.push(plateDeclLine(statement));
        {
          const plateLabel = plateLabelLine(statement, doc);
          if (plateLabel) {
            lines.push(plateLabel);
          }
        }
        break;
      case "factor":
        factorGeometry.set(statement, resolveFactorGeometry(statement, positions));
        break;
      default:
        break;
    }
  }

  // Pass 2 emits factor nodes after any bridge geometry has been resolved.
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
      lines.push(factorLine(statement, factorIds, positions, doc));
      continue;
    }

    const pair = geometry?.bridgedPair;
    if (!pair) {
      lines.push(factorLine(statement, factorIds, positions, doc));
      continue;
    }

    const left = positions.get(pair[0]);
    const right = positions.get(pair[1]);
    if (!left || !right || !geometry) {
      lines.push(factorLine(statement, factorIds, positions, doc));
      continue;
    }

    bridgeSpecs.set(statement, {
      left: pair[0],
      right: pair[1],
      control: controlFromFactorPoint(left, geometry.point, right),
      color: statement.color
    });
    lines.push(factorLine(statement, factorIds, positions, doc));
  }

  // Pass 3 emits all implied edges, skipping any pair already replaced by a bridge.
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
        const curveOverride = curves.directed.get(`${parent}\u0000${statement.name}`);
        const edgeOverride = directedEdges.get(`${parent}\u0000${statement.name}`);
        edgeLines.push(directedEdgeLine(parent, statement.name, curveOverride, edgeOverride));
      }
    }
  }

  lines.push(...edgeLines, "\\end{tikzpicture}");
  return `${lines.join("\n")}\n`;
}
