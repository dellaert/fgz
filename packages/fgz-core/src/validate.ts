import { FgzError } from "./error.js";
import type {
  BNDecl,
  CurveDecl,
  Document,
  FactorDecl,
  Statement,
  ValidationIssue,
  ValidationResult,
  VarDecl
} from "./types.js";

type SymbolDecl = VarDecl | BNDecl;

function symbolLabel(kind: SymbolDecl["kind"]): string {
  switch (kind) {
    case "var":
      return "variable";
    case "known":
      return "known";
    case "node":
      return "node";
    case "known_node":
      return "known_node";
  }
}

function addIssue(errors: ValidationIssue[], line: number, message: string): void {
  errors.push({ line, message });
}

function curvePairKey(a: string, b: string): string {
  return [a, b].sort().join("\u0000");
}

function isFactorSymbol(kind: SymbolDecl["kind"]): boolean {
  return kind === "var" || kind === "known";
}

function isBnSymbol(kind: SymbolDecl["kind"]): boolean {
  return kind === "node" || kind === "known_node";
}

function collectSymbols(statements: Statement[], errors: ValidationIssue[]): Map<string, SymbolDecl> {
  const symbols = new Map<string, SymbolDecl>();

  for (const statement of statements) {
    if (
      statement.kind !== "var" &&
      statement.kind !== "known" &&
      statement.kind !== "node" &&
      statement.kind !== "known_node"
    ) {
      continue;
    }

    const existing = symbols.get(statement.name);
    if (existing) {
      addIssue(
        errors,
        statement.loc.line,
        `duplicate symbol "${statement.name}" already declared as ${symbolLabel(existing.kind)} on line ${existing.loc.line}`
      );
      continue;
    }
    symbols.set(statement.name, statement);
  }

  return symbols;
}

function collectCurveTargets(statements: Statement[]): Map<string, FactorDecl[]> {
  const matches = new Map<string, FactorDecl[]>();

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
        const key = curvePairKey(left, right);
        const current = matches.get(key);
        if (current) {
          current.push(statement);
        } else {
          matches.set(key, [statement]);
        }
      }
    }
  }

  return matches;
}

function validateFactorDecl(
  statement: FactorDecl,
  symbols: Map<string, SymbolDecl>,
  errors: ValidationIssue[]
): void {
  for (const name of statement.vars) {
    const symbol = symbols.get(name);
    if (!symbol) {
      addIssue(errors, statement.loc.line, `factor references unknown symbol "${name}"`);
      continue;
    }
    if (!isFactorSymbol(symbol.kind)) {
      addIssue(
        errors,
        statement.loc.line,
        `factor references "${name}", which is declared as ${symbolLabel(symbol.kind)}`
      );
    }
  }
}

function validateBnDecl(statement: BNDecl, symbols: Map<string, SymbolDecl>, errors: ValidationIssue[]): void {
  for (const parent of statement.parents) {
    const symbol = symbols.get(parent);
    if (!symbol) {
      addIssue(errors, statement.loc.line, `node references unknown parent "${parent}"`);
      continue;
    }
    if (!isBnSymbol(symbol.kind)) {
      addIssue(
        errors,
        statement.loc.line,
        `node parent "${parent}" is declared as ${symbolLabel(symbol.kind)}`
      );
    }
  }
}

function validateCurveDecl(
  statement: CurveDecl,
  statements: Statement[],
  factorPairs: Map<string, FactorDecl[]>,
  errors: ValidationIssue[]
): void {
  if (!statement.directed) {
    const matches = factorPairs.get(curvePairKey(statement.a, statement.b)) ?? [];
    if (matches.length === 0) {
      addIssue(
        errors,
        statement.loc.line,
        `curve override "${statement.a} -- ${statement.b}" does not match any implied factor connection`
      );
    } else if (matches.length > 1) {
      addIssue(
        errors,
        statement.loc.line,
        `curve override "${statement.a} -- ${statement.b}" is ambiguous across multiple factors`
      );
    }
    return;
  }

  const child = statements.find(
    (candidate): candidate is BNDecl =>
      (candidate.kind === "node" || candidate.kind === "known_node") && candidate.name === statement.b
  );

  if (!child || !child.parents.includes(statement.a)) {
    addIssue(
      errors,
      statement.loc.line,
      `curve override "${statement.a} -> ${statement.b}" does not match any implied Bayes-net edge`
    );
  }
}

/**
 * Validate a parsed document.
 */
export function validate(doc: Document): ValidationResult {
  const errors: ValidationIssue[] = [];

  if (doc.version !== 1) {
    addIssue(errors, doc.headerLoc.line, `unsupported fgz version "${String(doc.version)}"`);
  }

  const symbols = collectSymbols(doc.statements, errors);
  const factorPairs = collectCurveTargets(doc.statements);

  for (const statement of doc.statements) {
    switch (statement.kind) {
      case "factor":
        validateFactorDecl(statement, symbols, errors);
        break;
      case "node":
      case "known_node":
        validateBnDecl(statement, symbols, errors);
        break;
      case "curve":
        validateCurveDecl(statement, doc.statements, factorPairs, errors);
        break;
      default:
        break;
    }
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

/**
 * Throw the first validation error if the document is invalid.
 */
export function assertValid(doc: Document): void {
  const result = validate(doc);
  if (!result.ok) {
    const first = result.errors[0];
    if (!first) {
      throw new FgzError("document validation failed");
    }
    throw new FgzError(first.message, first.line);
  }
}
