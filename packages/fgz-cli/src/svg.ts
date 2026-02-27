import { readFileSync } from "node:fs";
import { toTikz } from "../../fgz-core/dist/index.js";
import type { Document } from "../../fgz-core/dist/index.js";

const supportSource = readFileSync(new URL("../../../tikz/fgz.tikz.tex", import.meta.url), "utf8").trim();

function buildTexDocument(tikz: string): string {
  return [
    "\\usepackage{tikz}",
    supportSource,
    "\\begin{document}",
    tikz.trimEnd(),
    "\\end{document}"
  ].join("\n");
}

function normalizeSvg(svg: string): string {
  return `${svg.replace(/\r\n/g, "\n").trim()}\n`;
}

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
export async function renderTikzToSvg(tikz: string): Promise<string> {
  const module = await import("node-tikzjax");
  const tex2svg = resolveTex2Svg(module);
  const svg = await tex2svg(buildTexDocument(tikz));
  return normalizeSvg(svg);
}

/** Render a validated fgz document into SVG via the shared TikZ pipeline. */
export async function renderDocumentToSvg(doc: Document): Promise<string> {
  return renderTikzToSvg(toTikz(doc));
}
