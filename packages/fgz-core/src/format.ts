import type {
  BNDecl,
  CurveDecl,
  Document,
  FactorDecl,
  MacroDef,
  Point,
  Statement,
  VarDecl
} from "./types.js";

function formatPoint(point: Point): string {
  return `(${point.rawX}, ${point.rawY})`;
}

function formatMacro(statement: MacroDef): string {
  return `${statement.lhs} = ${statement.rhsLatex}`;
}

function formatVar(statement: VarDecl): string {
  const head = statement.kind === "var" ? "variable" : "known";
  return `${head} ${statement.name} ${formatPoint(statement.pos)}`;
}

function formatFactor(statement: FactorDecl): string {
  const point = statement.pos ? ` ${formatPoint(statement.pos)}` : "";
  const base = `factor {${statement.vars.join(", ")}}${point}`;
  return statement.shape ? `${base} shape=${statement.shape}` : base;
}

function formatBn(statement: BNDecl): string {
  return `${statement.kind} ${statement.name} {${statement.parents.join(", ")}} ${formatPoint(statement.pos)}`;
}

function formatCurve(statement: CurveDecl): string {
  const operator = statement.directed ? "->" : "--";
  return `curve ${statement.a} ${operator} ${statement.b} via ${formatPoint(statement.control)}`;
}

function formatStatement(statement: Statement): string {
  switch (statement.kind) {
    case "theme":
      return `theme ${statement.theme}`;
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
  }
}

/**
 * Format a parsed document without changing statement order.
 */
export function formatFgz(doc: Document): string {
  const lines = ["fgz 1", ...doc.statements.map(formatStatement)];
  return `${lines.join("\n")}\n`;
}
