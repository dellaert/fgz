import { FgzError } from "./error.js";
import type {
  BNDecl,
  CurveDecl,
  Document,
  FactorDecl,
  MacroDef,
  Point,
  Statement,
  Theme,
  ThemeDecl,
  VarDecl
} from "./types.js";

const THEMES = new Set<Theme>(["classic", "textbook", "blog"]);
const NAME_PATTERN = String.raw`([^\s{}(),=#]+)`;
const NUMBER_PATTERN = String.raw`([-+]?(?:\d+(?:\.\d+)?|\.\d+))`;
const POINT_PATTERN = String.raw`\(\s*${NUMBER_PATTERN}\s*,\s*${NUMBER_PATTERN}\s*\)`;

function capture(match: RegExpMatchArray, index: number, line: number): string {
  const value = match[index];
  if (value === undefined) {
    throw new FgzError("internal parser error", line);
  }
  return value;
}

function stripComment(line: string): string {
  const commentIndex = line.indexOf("#");
  return commentIndex === -1 ? line : line.slice(0, commentIndex);
}

function parsePoint(line: number, rawX: string, rawY: string): Point {
  const x = Number(rawX);
  const y = Number(rawY);

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new FgzError("invalid point", line);
  }

  return { x, y, rawX, rawY };
}

function parseNameList(body: string, line: number, label: string, allowEmpty: boolean): string[] {
  const trimmed = body.trim();
  if (trimmed === "") {
    if (allowEmpty) {
      return [];
    }
    throw new FgzError(`${label} must contain at least one name`, line);
  }

  const names = trimmed.split(",").map((part) => part.trim());
  if (names.some((name) => name.length === 0)) {
    throw new FgzError(`invalid ${label}`, line);
  }
  return names;
}

function parseTheme(raw: string, line: number): ThemeDecl | undefined {
  const match = raw.match(/^theme\s+([A-Za-z]+)\s*$/);
  if (!match) {
    return undefined;
  }

  const theme = match[1] as Theme;
  if (!THEMES.has(theme)) {
    throw new FgzError(`unknown theme "${match[1]}"`, line);
  }

  return { kind: "theme", theme, loc: { line } };
}

function parseMacro(raw: string, line: number): MacroDef | undefined {
  const match = raw.match(/^([^\s=#]+)\s*=\s*(.+?)\s*$/);
  if (!match) {
    return undefined;
  }

  return {
    kind: "macro",
    lhs: capture(match, 1, line),
    rhsLatex: capture(match, 2, line),
    loc: { line }
  };
}

function parseVarLike(raw: string, line: number): VarDecl | undefined {
  const match = raw.match(new RegExp(`^(variable|known)\\s+${NAME_PATTERN}\\s+${POINT_PATTERN}\\s*$`));
  if (!match) {
    return undefined;
  }

  return {
    kind: capture(match, 1, line) === "variable" ? "var" : "known",
    name: capture(match, 2, line),
    pos: parsePoint(line, capture(match, 3, line), capture(match, 4, line)),
    loc: { line }
  };
}

function parseFactor(raw: string, line: number): FactorDecl | undefined {
  const match = raw.match(
    new RegExp(`^factor\\s+\\{([^}]*)\\}\\s+${POINT_PATTERN}(?:\\s+shape=(circle|square))?\\s*$`)
  );
  if (!match) {
    return undefined;
  }

  const shape = match[4] as FactorDecl["shape"] | undefined;

  return {
    kind: "factor",
    vars: parseNameList(capture(match, 1, line), line, "factor variable list", false),
    pos: parsePoint(line, capture(match, 2, line), capture(match, 3, line)),
    ...(shape ? { shape } : {}),
    loc: { line }
  };
}

function parseBn(raw: string, line: number): BNDecl | undefined {
  const match = raw.match(
    new RegExp(`^(node|known_node)\\s+${NAME_PATTERN}\\s+\\{([^}]*)\\}\\s+${POINT_PATTERN}\\s*$`)
  );
  if (!match) {
    return undefined;
  }

  return {
    kind: capture(match, 1, line) as BNDecl["kind"],
    name: capture(match, 2, line),
    parents: parseNameList(capture(match, 3, line), line, "parent list", true),
    pos: parsePoint(line, capture(match, 4, line), capture(match, 5, line)),
    loc: { line }
  };
}

function parseCurve(raw: string, line: number): CurveDecl | undefined {
  const match = raw.match(
    new RegExp(`^curve\\s+${NAME_PATTERN}\\s+(--|->)\\s+${NAME_PATTERN}\\s+via\\s+${POINT_PATTERN}\\s*$`)
  );
  if (!match) {
    return undefined;
  }

  return {
    kind: "curve",
    a: capture(match, 1, line),
    directed: capture(match, 2, line) === "->",
    b: capture(match, 3, line),
    control: parsePoint(line, capture(match, 4, line), capture(match, 5, line)),
    loc: { line }
  };
}

function parseStatement(raw: string, line: number): Statement {
  return (
    parseTheme(raw, line) ??
    parseVarLike(raw, line) ??
    parseFactor(raw, line) ??
    parseBn(raw, line) ??
    parseCurve(raw, line) ??
    parseMacro(raw, line) ??
    (() => {
      throw new FgzError("could not parse statement", line);
    })()
  );
}

/**
 * Parse a .fgz document into the ordered AST.
 */
export function parseFgz(text: string): Document {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const statements: Statement[] = [];
  const macros = new Map<string, string>();
  let headerLoc: { line: number } | undefined;
  let theme: Theme | undefined;

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const raw = stripComment(lines[index] ?? "").trim();
    if (raw === "") {
      continue;
    }

    if (!headerLoc) {
      const header = raw.match(/^fgz\s+(\d+)\s*$/);
      if (!header) {
        throw new FgzError('expected header "fgz 1"', lineNumber);
      }
      if (header[1] !== "1") {
        throw new FgzError(`unsupported fgz version "${header[1]}"`, lineNumber);
      }
      headerLoc = { line: lineNumber };
      continue;
    }

    const statement = parseStatement(raw, lineNumber);
    if (statement.kind === "theme") {
      if (theme) {
        throw new FgzError("theme already declared", lineNumber);
      }
      theme = statement.theme;
    }

    if (statement.kind === "macro") {
      if (macros.has(statement.lhs)) {
        throw new FgzError(`duplicate macro "${statement.lhs}"`, lineNumber);
      }
      macros.set(statement.lhs, statement.rhsLatex);
    }

    statements.push(statement);
  }

  if (!headerLoc) {
    throw new FgzError('expected header "fgz 1"', 1);
  }

  return {
    version: 1,
    statements,
    macros,
    headerLoc,
    ...(theme ? { theme } : {})
  };
}
