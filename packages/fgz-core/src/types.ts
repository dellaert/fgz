/** Supported built-in themes. */
export type Theme = "classic" | "textbook" | "blog";

/** Source location used for parser and validator diagnostics. */
export interface SourceLocation {
  line: number;
}

/** Point in TikZ units, preserving the authored numeric text. */
export interface Point {
  x: number;
  y: number;
  rawX: string;
  rawY: string;
}

export interface ThemeDecl {
  kind: "theme";
  theme: Theme;
  loc: SourceLocation;
}

export interface MacroDef {
  kind: "macro";
  lhs: string;
  rhsLatex: string;
  loc: SourceLocation;
}

export interface VarDecl {
  kind: "var" | "known";
  name: string;
  pos: Point;
  color?: string;
  loc: SourceLocation;
}

export interface FactorDecl {
  kind: "factor";
  vars: string[];
  pos?: Point;
  shape?: "circle" | "square";
  color?: string;
  loc: SourceLocation;
}

export interface BNDecl {
  kind: "node" | "known_node";
  name: string;
  parents: string[];
  pos: Point;
  color?: string;
  loc: SourceLocation;
}

export interface CurveDecl {
  kind: "curve";
  a: string;
  b: string;
  directed: boolean;
  control: Point;
  color?: string;
  loc: SourceLocation;
}

export type Statement =
  | ThemeDecl
  | MacroDef
  | VarDecl
  | FactorDecl
  | BNDecl
  | CurveDecl;

/** Parsed fgz document. */
export interface Document {
  version: 1;
  theme?: Theme;
  statements: Statement[];
  macros: Map<string, string>;
  headerLoc: SourceLocation;
}

export interface ValidationIssue {
  line: number;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationIssue[];
}
