import type {
  BNDecl,
  BoxDecl,
  CurveDecl,
  Document,
  EdgeDecl,
  FactorDecl,
  MacroDef,
  Point,
  PlateDecl,
  StyleDecl,
  Statement,
  TextDecl,
  VarDecl
} from "./types.js";

function formatPoint(point: Point): string {
  return `(${point.rawX}, ${point.rawY})`;
}

function formatAttributes(entries: Array<[string, string | undefined]>): string {
  const parts = entries.flatMap(([key, value]) => (value ? [`${key}=${value}`] : []));
  return parts.length === 0 ? "" : ` ${parts.join(" ")}`;
}

function formatMacro(statement: MacroDef): string {
  return `${statement.lhs} = ${statement.rhsLatex}`;
}

function formatStyle(statement: StyleDecl): string {
  return `style${formatAttributes([
    ["node_size", statement.nodeSize],
    ["factor_size", statement.factorSize],
    ["label_sep", statement.labelSep],
    ["label_font", statement.labelFont]
  ])}`;
}

function formatVar(statement: VarDecl): string {
  const head = statement.kind === "var" ? "variable" : "known";
  return `${head} ${statement.name} ${formatPoint(statement.pos)}${formatAttributes([
    ["color", statement.color],
    ["size", statement.size],
    ["font", statement.font]
  ])}`;
}

function formatFactor(statement: FactorDecl): string {
  const point = statement.pos ? ` ${formatPoint(statement.pos)}` : "";
  const base = `factor {${statement.vars.join(", ")}}${point}`;
  return `${base}${formatAttributes([
    ["offset", statement.offset ? formatPoint(statement.offset) : undefined],
    ["shape", statement.shape],
    ["color", statement.color],
    ["label", statement.label],
    ["size", statement.size],
    ["font", statement.font]
  ])}`;
}

function formatBn(statement: BNDecl): string {
  return `${statement.kind} ${statement.name} {${statement.parents.join(", ")}} ${formatPoint(statement.pos)}${formatAttributes([
    ["color", statement.color],
    ["size", statement.size],
    ["font", statement.font]
  ])}`;
}

function formatCurve(statement: CurveDecl): string {
  const operator = statement.directed ? "->" : "--";
  return `curve ${statement.a} ${operator} ${statement.b} via ${formatPoint(statement.control)}${formatAttributes([
    ["color", statement.color]
  ])}`;
}

function formatEdge(statement: EdgeDecl): string {
  return `edge ${statement.a} -> ${statement.b}${formatAttributes([
    ["style", statement.style],
    ["label", statement.label],
    ["label_side", statement.labelSide],
    ["label_pos", statement.labelPos]
  ])}`;
}

function formatText(statement: TextDecl): string {
  return `text ${statement.name} ${formatPoint(statement.pos)}${formatAttributes([
    ["color", statement.color],
    ["font", statement.font]
  ])}`;
}

function formatBox(statement: BoxDecl): string {
  return `box ${formatPoint(statement.from)} ${formatPoint(statement.to)}${formatAttributes([
    ["style", statement.style],
    ["color", statement.color]
  ])}`;
}

function formatPlate(statement: PlateDecl): string {
  return `plate ${formatPoint(statement.from)} ${formatPoint(statement.to)}${formatAttributes([
    ["color", statement.color],
    ["label", statement.label],
    ["font", statement.font]
  ])}`;
}

function formatStatement(statement: Statement): string {
  switch (statement.kind) {
    case "theme":
      return `theme ${statement.theme}`;
    case "style":
      return formatStyle(statement);
    case "macro":
      return formatMacro(statement);
    case "var":
    case "known":
      return formatVar(statement);
    case "factor":
      return formatFactor(statement);
    case "node":
    case "known_node":
      return formatBn(statement);
    case "curve":
      return formatCurve(statement);
    case "edge":
      return formatEdge(statement);
    case "text":
      return formatText(statement);
    case "box":
      return formatBox(statement);
    case "plate":
      return formatPlate(statement);
  }
}

/**
 * Format a parsed document without changing statement order.
 */
export function formatFgz(doc: Document): string {
  const lines = ["fgz 1", ...doc.statements.map(formatStatement)];
  return `${lines.join("\n")}\n`;
}
