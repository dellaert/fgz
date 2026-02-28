import { FgzError } from "./error.js";
import type {
  BNDecl,
  BoxDecl,
  CurveDecl,
  Document,
  EdgeDecl,
  FactorDecl,
  MacroDef,
  PlateDecl,
  Point,
  StyleDecl,
  Statement,
  TextDecl,
  Theme,
  ThemeDecl,
  VarDecl
} from "./types.js";

const THEMES = new Set<Theme>(["classic", "textbook", "blog"]);
const NAME_PATTERN = String.raw`([^\s(),=#]+)`;
const NUMBER_PATTERN = String.raw`([-+]?(?:\d+(?:\.\d+)?|\.\d+))`;
const POINT_PATTERN = String.raw`\(\s*${NUMBER_PATTERN}\s*,\s*${NUMBER_PATTERN}\s*\)`;

/** Parse a whitespace-separated attribute list into a key/value map. */
function parseAttributes(raw: string | undefined, line: number, allowed: readonly string[]): Record<string, string> {
  const attrs: Record<string, string> = {};
  const trimmed = raw?.trim() ?? "";
  if (trimmed === "") {
    return attrs;
  }

  for (const token of trimmed.split(/\s+/)) {
    const equalsIndex = token.indexOf("=");
    if (equalsIndex <= 0 || equalsIndex === token.length - 1) {
      throw new FgzError(`invalid attribute "${token}"`, line);
    }

    const key = token.slice(0, equalsIndex);
    const value = token.slice(equalsIndex + 1);
    if (!allowed.includes(key)) {
      throw new FgzError(`unknown attribute "${key}"`, line);
    }
    attrs[key] = value;
  }

  return attrs;
}

/** Read a required regex capture or throw a parser error. */
function capture(match: RegExpMatchArray, index: number, line: number): string {
  const value = match[index];
  if (value === undefined) {
    throw new FgzError("internal parser error", line);
  }
  return value;
}

/** Remove trailing `#` comments from a source line. */
function stripComment(line: string): string {
  const commentIndex = line.indexOf("#");
  return commentIndex === -1 ? line : line.slice(0, commentIndex);
}

/** Parse a numeric point while preserving the authored coordinate text. */
function parsePoint(line: number, rawX: string, rawY: string): Point {
  const x = Number(rawX);
  const y = Number(rawY);

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new FgzError("invalid point", line);
  }

  return { x, y, rawX, rawY };
}

/** Parse a parenthesized inline point value such as `(1,2)`. */
function parseInlinePoint(raw: string, line: number, label: string): Point {
  const match = raw.match(new RegExp(`^${POINT_PATTERN}$`));
  if (!match) {
    throw new FgzError(`invalid ${label}`, line);
  }
  return parsePoint(line, capture(match, 1, line), capture(match, 2, line));
}

/** Parse a comma-separated list of names, allowing nested braces in labels. */
function parseNameList(body: string, line: number, label: string, allowEmpty: boolean): string[] {
  const trimmed = body.trim();
  if (trimmed === "") {
    if (allowEmpty) {
      return [];
    }
    throw new FgzError(`${label} must contain at least one name`, line);
  }

  const names: string[] = [];
  let depth = 0;
  let start = 0;

  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index];
    if (char === "{") {
      depth += 1;
      continue;
    }
    if (char === "}") {
      depth -= 1;
      if (depth < 0) {
        throw new FgzError(`invalid ${label}`, line);
      }
      continue;
    }
    if (char === "," && depth === 0) {
      names.push(trimmed.slice(start, index).trim());
      start = index + 1;
    }
  }

  if (depth !== 0) {
    throw new FgzError(`invalid ${label}`, line);
  }

  names.push(trimmed.slice(start).trim());
  if (names.some((name) => name.length === 0)) {
    throw new FgzError(`invalid ${label}`, line);
  }
  return names;
}

/** Parse a `theme` declaration when present. */
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

/** Parse a document-level `style` declaration when present. */
function parseStyle(raw: string, line: number): StyleDecl | undefined {
  const match = raw.match(/^style(?:\s+(.*?))?\s*$/);
  if (!match) {
    return undefined;
  }

  const attrs = parseAttributes(match[1], line, ["node_size", "factor_size", "label_sep", "label_font"]);
  if (Object.keys(attrs).length === 0) {
    throw new FgzError("style must include at least one attribute", line);
  }

  return {
    kind: "style",
    ...(attrs.node_size ? { nodeSize: attrs.node_size } : {}),
    ...(attrs.factor_size ? { factorSize: attrs.factor_size } : {}),
    ...(attrs.label_sep ? { labelSep: attrs.label_sep } : {}),
    ...(attrs.label_font ? { labelFont: attrs.label_font } : {}),
    loc: { line }
  };
}

/** Parse a macro definition line of the form `lhs = rhs`. */
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

/** Parse either a `variable` or `known` declaration. */
function parseVarLike(raw: string, line: number): VarDecl | undefined {
  const match = raw.match(new RegExp(`^(variable|known)\\s+${NAME_PATTERN}\\s+${POINT_PATTERN}(?:\\s+(.*?))?\\s*$`));
  if (!match) {
    return undefined;
  }

  const attrs = parseAttributes(match[5], line, ["color", "size", "font"]);
  return {
    kind: capture(match, 1, line) === "variable" ? "var" : "known",
    name: capture(match, 2, line),
    pos: parsePoint(line, capture(match, 3, line), capture(match, 4, line)),
    ...(attrs.color ? { color: attrs.color } : {}),
    ...(attrs.size ? { size: attrs.size } : {}),
    ...(attrs.font ? { font: attrs.font } : {}),
    loc: { line }
  };
}

/** Parse a factor declaration, including midpoint-based geometry attributes. */
function parseFactor(raw: string, line: number): FactorDecl | undefined {
  const match = raw.match(
    new RegExp(`^factor\\s+\\{(.*)\\}(?:\\s+${POINT_PATTERN})?(?:\\s+(.*?))?\\s*$`)
  );
  if (!match) {
    return undefined;
  }

  const hasPoint = match[2] !== undefined && match[3] !== undefined;
  const attrs = parseAttributes(match[4], line, ["shape", "color", "offset", "label", "size", "font"]);
  const shape = attrs.shape as FactorDecl["shape"] | undefined;
  const offset = attrs.offset ? parseInlinePoint(attrs.offset, line, "factor offset") : undefined;

  return {
    kind: "factor",
    vars: parseNameList(capture(match, 1, line), line, "factor variable list", false),
    ...(hasPoint ? { pos: parsePoint(line, capture(match, 2, line), capture(match, 3, line)) } : {}),
    ...(offset ? { offset } : {}),
    ...(shape ? { shape } : {}),
    ...(attrs.color ? { color: attrs.color } : {}),
    ...(attrs.label ? { label: attrs.label } : {}),
    ...(attrs.size ? { size: attrs.size } : {}),
    ...(attrs.font ? { font: attrs.font } : {}),
    loc: { line }
  };
}

/** Parse either a latent or observed Bayes-net node declaration. */
function parseBn(raw: string, line: number): BNDecl | undefined {
  const match = raw.match(
    new RegExp(`^(node|known_node)\\s+${NAME_PATTERN}\\s+\\{(.*)\\}\\s+${POINT_PATTERN}(?:\\s+(.*?))?\\s*$`)
  );
  if (!match) {
    return undefined;
  }

  const attrs = parseAttributes(match[6], line, ["color", "size", "font"]);
  return {
    kind: capture(match, 1, line) as BNDecl["kind"],
    name: capture(match, 2, line),
    parents: parseNameList(capture(match, 3, line), line, "parent list", true),
    pos: parsePoint(line, capture(match, 4, line), capture(match, 5, line)),
    ...(attrs.color ? { color: attrs.color } : {}),
    ...(attrs.size ? { size: attrs.size } : {}),
    ...(attrs.font ? { font: attrs.font } : {}),
    loc: { line }
  };
}

/** Parse a directed or undirected curve override. */
function parseCurve(raw: string, line: number): CurveDecl | undefined {
  const match = raw.match(
    new RegExp(`^curve\\s+${NAME_PATTERN}\\s+(--|->)\\s+${NAME_PATTERN}\\s+via\\s+${POINT_PATTERN}(?:\\s+(.*?))?\\s*$`)
  );
  if (!match) {
    return undefined;
  }

  const attrs = parseAttributes(match[6], line, ["color"]);
  return {
    kind: "curve",
    a: capture(match, 1, line),
    directed: capture(match, 2, line) === "->",
    b: capture(match, 3, line),
    control: parsePoint(line, capture(match, 4, line), capture(match, 5, line)),
    ...(attrs.color ? { color: attrs.color } : {}),
    loc: { line }
  };
}

/** Parse a directed Bayes-net edge override. */
function parseEdge(raw: string, line: number): EdgeDecl | undefined {
  const match = raw.match(new RegExp(`^edge\\s+${NAME_PATTERN}\\s+->\\s+${NAME_PATTERN}(?:\\s+(.*?))?\\s*$`));
  if (!match) {
    return undefined;
  }

  const attrs = parseAttributes(match[3], line, ["style", "label", "label_side", "label_pos"]);
  const style = attrs.style as EdgeDecl["style"] | undefined;
  const labelSide = attrs.label_side as EdgeDecl["labelSide"] | undefined;

  return {
    kind: "edge",
    a: capture(match, 1, line),
    b: capture(match, 2, line),
    ...(style ? { style } : {}),
    ...(attrs.label ? { label: attrs.label } : {}),
    ...(labelSide ? { labelSide } : {}),
    ...(attrs.label_pos ? { labelPos: attrs.label_pos } : {}),
    loc: { line }
  };
}

/** Parse a free-standing text annotation. */
function parseText(raw: string, line: number): TextDecl | undefined {
  const match = raw.match(new RegExp(`^text\\s+${NAME_PATTERN}\\s+${POINT_PATTERN}(?:\\s+(.*?))?\\s*$`));
  if (!match) {
    return undefined;
  }

  const attrs = parseAttributes(match[4], line, ["color", "font"]);
  return {
    kind: "text",
    name: capture(match, 1, line),
    pos: parsePoint(line, capture(match, 2, line), capture(match, 3, line)),
    ...(attrs.color ? { color: attrs.color } : {}),
    ...(attrs.font ? { font: attrs.font } : {}),
    loc: { line }
  };
}

/** Parse a rectangular box annotation or degenerate box separator. */
function parseBox(raw: string, line: number): BoxDecl | undefined {
  const match = raw.match(new RegExp(`^box\\s+${POINT_PATTERN}\\s+${POINT_PATTERN}(?:\\s+(.*?))?\\s*$`));
  if (!match) {
    return undefined;
  }

  const attrs = parseAttributes(match[5], line, ["style", "color"]);
  const statement: BoxDecl = {
    kind: "box",
    from: parsePoint(line, capture(match, 1, line), capture(match, 2, line)),
    to: parsePoint(line, capture(match, 3, line), capture(match, 4, line)),
    loc: { line }
  };

  if (attrs.style) {
    statement.style = attrs.style as NonNullable<BoxDecl["style"]>;
  }
  if (attrs.color) {
    statement.color = attrs.color;
  }

  return statement;
}

/** Parse a labeled plate annotation for repeated substructure. */
function parsePlate(raw: string, line: number): PlateDecl | undefined {
  const match = raw.match(new RegExp(`^plate\\s+${POINT_PATTERN}\\s+${POINT_PATTERN}(?:\\s+(.*?))?\\s*$`));
  if (!match) {
    return undefined;
  }

  const attrs = parseAttributes(match[5], line, ["color", "label", "font"]);
  const statement: PlateDecl = {
    kind: "plate",
    from: parsePoint(line, capture(match, 1, line), capture(match, 2, line)),
    to: parsePoint(line, capture(match, 3, line), capture(match, 4, line)),
    loc: { line }
  };

  if (attrs.color) {
    statement.color = attrs.color;
  }
  if (attrs.label) {
    statement.label = attrs.label;
  }
  if (attrs.font) {
    statement.font = attrs.font;
  }

  return statement;
}

/** Parse a single non-header statement by trying each known grammar branch in order. */
function parseStatement(raw: string, line: number): Statement {
  return (
    parseTheme(raw, line) ??
    parseStyle(raw, line) ??
    parseVarLike(raw, line) ??
    parseFactor(raw, line) ??
    parseBn(raw, line) ??
    parseCurve(raw, line) ??
    parseEdge(raw, line) ??
    parseText(raw, line) ??
    parseBox(raw, line) ??
    parsePlate(raw, line) ??
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
      // The first non-empty, non-comment line must always be the version header.
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
      // Preserve authored order, but still track the effective theme separately.
      if (theme) {
        throw new FgzError("theme already declared", lineNumber);
      }
      theme = statement.theme;
    }

    if (statement.kind === "macro") {
      // Macro labels are resolved during formatting and TikZ generation.
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
