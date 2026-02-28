import { readFileSync } from "node:fs";
import { toTikz } from "../../fgz-core/dist/index.js";
import type { Document } from "../../fgz-core/dist/index.js";

const supportSource = readFileSync(new URL("../../../tikz/fgz.tikz.tex", import.meta.url), "utf8").trim();

export interface SvgRenderOptions {
  macroSource?: string;
}

/** Wrap a TikZ snippet in the minimal TeX document expected by node-tikzjax. */
function buildTexDocument(tikz: string, options: SvgRenderOptions = {}): string {
  return [
    "\\usepackage{tikz}",
    options.macroSource?.trim(),
    supportSource,
    "\\begin{document}",
    tikz.trimEnd(),
    "\\end{document}"
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

/** Normalize line endings so SVG golden tests stay stable. */
function normalizeSvg(svg: string): string {
  return `${svg.replace(/\r\n/g, "\n").trim()}\n`;
}

/** Unwrap the default-export shape used by node-tikzjax across module formats. */
function resolveTex2Svg(module: unknown): (input: string) => Promise<string> {
  let current = module;

  while (current && typeof current !== "function" && typeof current === "object" && "default" in current) {
    current = current.default;
  }

  if (typeof current !== "function") {
    throw new Error("unable to load node-tikzjax renderer");
  }

  return current as (input: string) => Promise<string>;
}

/** Render a TikZ snippet into SVG via node-tikzjax. */
export async function renderTikzToSvg(tikz: string, options: SvgRenderOptions = {}): Promise<string> {
  const module = await import("node-tikzjax");
  const tex2svg = resolveTex2Svg(module);
  const svg = await tex2svg(buildTexDocument(tikz, options));
  return normalizeSvg(svg);
}

/** Render a validated fgz document into SVG via the shared TikZ pipeline. */
export async function renderDocumentToSvg(doc: Document, options: SvgRenderOptions = {}): Promise<string> {
  return renderTikzToSvg(toTikz(doc), options);
}
