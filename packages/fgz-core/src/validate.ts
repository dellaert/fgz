import { FgzError } from "./error.js";
import type {
  BNDecl,
  BoxDecl,
  CurveDecl,
  Document,
  EdgeDecl,
  FactorDecl,
  PlateDecl,
  Statement,
  ValidationIssue,
  ValidationResult,
  VarDecl
} from "./types.js";

type SymbolDecl = VarDecl | BNDecl;
type FgSymbolDecl = VarDecl;
type BnSymbolDecl = BNDecl;

interface SymbolBinding {
  fg: FgSymbolDecl | undefined;
  bn: BnSymbolDecl | undefined;
}

/** Convert an internal symbol kind into user-facing validation text. */
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

/** Append a validation issue with its source line. */
function addIssue(errors: ValidationIssue[], line: number, message: string): void {
  errors.push({ line, message });
}

/** Build an order-insensitive key for a pair of factor-graph symbols. */
function curvePairKey(a: string, b: string): string {
  return [a, b].sort().join("\u0000");
}

/** Return whether a symbol kind belongs to the factor-graph namespace. */
function isFactorSymbol(kind: SymbolDecl["kind"]): boolean {
  return kind === "var" || kind === "known";
}

/** Return whether a symbol kind belongs to the Bayes-net namespace. */
function isBnSymbol(kind: SymbolDecl["kind"]): boolean {
  return kind === "node" || kind === "known_node";
}

/** Return whether a declaration represents an observed symbol. */
function isObserved(kind: SymbolDecl["kind"]): boolean {
  return kind === "known" || kind === "known_node";
}

/** Check whether a factor-graph and BN declaration occupy the same position. */
function samePosition(left: VarDecl["pos"], right: BNDecl["pos"]): boolean {
  return left.x === right.x && left.y === right.y;
}

/** Report cross-namespace symbol reuse when a name is declared in both worlds. */
function ensureCompatibleBinding(name: string, binding: SymbolBinding, errors: ValidationIssue[]): void {
  if (!binding.fg || !binding.bn) {
    return;
  }

  addIssue(
    errors,
    binding.bn.loc.line,
    `symbol "${name}" cannot be declared as both ${symbolLabel(binding.fg.kind)} and ${symbolLabel(binding.bn.kind)}`
  );
}

/** Collect symbol declarations while checking duplicates and mixed-namespace reuse. */
function collectSymbols(statements: Statement[], errors: ValidationIssue[]): Map<string, SymbolBinding> {
  const symbols = new Map<string, SymbolBinding>();

  for (const statement of statements) {
    if (
      statement.kind !== "var" &&
      statement.kind !== "known" &&
      statement.kind !== "node" &&
      statement.kind !== "known_node"
    ) {
      continue;
    }

    const binding = symbols.get(statement.name) ?? { fg: undefined, bn: undefined };

    if (statement.kind === "var" || statement.kind === "known") {
      if (binding.fg) {
        addIssue(
          errors,
          statement.loc.line,
          `duplicate symbol "${statement.name}" already declared as ${symbolLabel(binding.fg.kind)} on line ${binding.fg.loc.line}`
        );
        continue;
      }
      binding.fg = statement;
    } else if (statement.kind === "node" || statement.kind === "known_node") {
      if (binding.bn) {
        addIssue(
          errors,
          statement.loc.line,
          `duplicate symbol "${statement.name}" already declared as ${symbolLabel(binding.bn.kind)} on line ${binding.bn.loc.line}`
        );
        continue;
      }
      binding.bn = statement;
    }

    ensureCompatibleBinding(statement.name, binding, errors);
    symbols.set(statement.name, binding);
  }

  return symbols;
}

/** Precompute all implied undirected factor connections for curve validation. */
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

/** Validate that a factor references legal symbols and legal geometry options. */
function validateFactorDecl(
  statement: FactorDecl,
  symbols: Map<string, SymbolBinding>,
  errors: ValidationIssue[]
): void {
  for (const name of statement.vars) {
    const binding = symbols.get(name);
    const symbol = binding?.fg;
    if (!symbol) {
      addIssue(errors, statement.loc.line, `factor references unknown symbol "${name}"`);
      continue;
    }
  }

  if (!statement.pos && statement.vars.length < 2) {
    addIssue(errors, statement.loc.line, "factor without a position must reference at least two variables");
  }

  if (statement.pos && statement.offset) {
    addIssue(errors, statement.loc.line, "factor offset cannot be combined with an explicit position");
  }
}

/** Validate that a Bayes-net node references declared parent symbols. */
function validateBnDecl(statement: BNDecl, symbols: Map<string, SymbolBinding>, errors: ValidationIssue[]): void {
  for (const parent of statement.parents) {
    const binding = symbols.get(parent);
    const symbol = binding?.fg ?? binding?.bn;
    if (!symbol) {
      addIssue(errors, statement.loc.line, `node references unknown parent "${parent}"`);
    }
  }
}

/** Validate that a curve override maps to an implied graph edge. */
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

/** Validate a directed BN edge override and its style attributes. */
function validateEdgeDecl(statement: EdgeDecl, statements: Statement[], errors: ValidationIssue[]): void {
  if (statement.style && statement.style !== "solid" && statement.style !== "dashed") {
    addIssue(errors, statement.loc.line, `unknown edge style "${statement.style}"`);
  }

  if (statement.labelSide && statement.labelSide !== "left" && statement.labelSide !== "right") {
    addIssue(errors, statement.loc.line, `unknown edge label side "${statement.labelSide}"`);
  }

  if (statement.labelPos) {
    const value = Number(statement.labelPos);
    if (!Number.isFinite(value) || value <= 0 || value >= 1) {
      addIssue(errors, statement.loc.line, `edge label_pos must be between 0 and 1, got "${statement.labelPos}"`);
    }
  }

  const child = statements.find(
    (candidate): candidate is BNDecl =>
      (candidate.kind === "node" || candidate.kind === "known_node") && candidate.name === statement.b
  );

  if (!child || !child.parents.includes(statement.a)) {
    addIssue(errors, statement.loc.line, `edge override "${statement.a} -> ${statement.b}" does not match any implied Bayes-net edge`);
  }
}

/** Validate the styling attributes accepted by box annotations. */
function validateBoxStyle(statement: BoxDecl, errors: ValidationIssue[]): void {
  if (statement.style && statement.style !== "solid" && statement.style !== "dashed") {
    addIssue(errors, statement.loc.line, `unknown box style "${statement.style}"`);
  }
}

/** Validate the minimal contract required by a plate annotation. */
function validatePlate(statement: PlateDecl, errors: ValidationIssue[]): void {
  if (!statement.label) {
    addIssue(errors, statement.loc.line, "plate requires a label");
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

  // Statement-local checks run after global symbol and edge context has been collected.
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
      case "edge":
        validateEdgeDecl(statement, doc.statements, errors);
        break;
      case "box":
        validateBoxStyle(statement, errors);
        break;
      case "plate":
        validatePlate(statement, errors);
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
