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

/** Format a point using the original authored numeric text. */
function formatPoint(point: Point): string {
  return `(${point.rawX}, ${point.rawY})`;
}

/** Format a sparse attribute list without emitting empty keys. */
function formatAttributes(entries: Array<[string, string | undefined]>): string {
  const parts = entries.flatMap(([key, value]) => (value ? [`${key}=${value}`] : []));
  return parts.length === 0 ? "" : ` ${parts.join(" ")}`;
}

/** Format a macro definition line. */
function formatMacro(statement: MacroDef): string {
  return `${statement.lhs} = ${statement.rhsLatex}`;
}

/** Format a document-level style declaration. */
function formatStyle(statement: StyleDecl): string {
  return `style${formatAttributes([
    ["node_size", statement.nodeSize],
    ["factor_size", statement.factorSize],
    ["label_sep", statement.labelSep],
    ["label_font", statement.labelFont]
  ])}`;
}

/** Format a factor-graph variable or known declaration. */
function formatVar(statement: VarDecl): string {
  const head = statement.kind === "var" ? "variable" : "known";
  return `${head} ${statement.name} ${formatPoint(statement.pos)}${formatAttributes([
    ["color", statement.color],
    ["size", statement.size],
    ["font", statement.font]
  ])}`;
}

/** Format a factor declaration without reordering authored attributes. */
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

/** Format a Bayes-net node declaration. */
function formatBn(statement: BNDecl): string {
  return `${statement.kind} ${statement.name} {${statement.parents.join(", ")}} ${formatPoint(statement.pos)}${formatAttributes([
    ["color", statement.color],
    ["size", statement.size],
    ["font", statement.font]
  ])}`;
}

/** Format a curve override declaration. */
function formatCurve(statement: CurveDecl): string {
  const operator = statement.directed ? "->" : "--";
  return `curve ${statement.a} ${operator} ${statement.b} via ${formatPoint(statement.control)}${formatAttributes([
    ["color", statement.color]
  ])}`;
}

/** Format a directed edge override declaration. */
function formatEdge(statement: EdgeDecl): string {
  return `edge ${statement.a} -> ${statement.b}${formatAttributes([
    ["style", statement.style],
    ["label", statement.label],
    ["label_side", statement.labelSide],
    ["label_pos", statement.labelPos]
  ])}`;
}

/** Format a text annotation declaration. */
function formatText(statement: TextDecl): string {
  return `text ${statement.name} ${formatPoint(statement.pos)}${formatAttributes([
    ["color", statement.color],
    ["font", statement.font]
  ])}`;
}

/** Format a box annotation declaration. */
function formatBox(statement: BoxDecl): string {
  return `box ${formatPoint(statement.from)} ${formatPoint(statement.to)}${formatAttributes([
    ["style", statement.style],
    ["color", statement.color]
  ])}`;
}

/** Format a plate annotation declaration. */
function formatPlate(statement: PlateDecl): string {
  return `plate ${formatPoint(statement.from)} ${formatPoint(statement.to)}${formatAttributes([
    ["color", statement.color],
    ["label", statement.label],
    ["font", statement.font]
  ])}`;
}

/** Dispatch formatting to the statement-specific formatter. */
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
