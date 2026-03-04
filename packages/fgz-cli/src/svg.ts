import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { toTikz } from "../../fgz-core/dist/index.js";
import type { Document } from "../../fgz-core/dist/index.js";

const supportSource = readFileSync(new URL("../../../tikz/fgz.tikz.tex", import.meta.url), "utf8").trim();
const nodeTikzJaxFontsCssSource = readFileSync(new URL("../../../node_modules/node-tikzjax/css/fonts.css", import.meta.url), "utf8");

const embeddedFontCssCache = new Map<string, string>();

export interface SvgRenderOptions {
  preambleSource?: string;
  backend?: "browser" | "native";
}

/** Wrap a TikZ snippet in a standalone document suitable for DVI-to-SVG conversion. */
function buildStandaloneTexDocument(tikz: string, options: SvgRenderOptions = {}): string {
  return [
    "\\documentclass[tikz,border=2pt]{standalone}",
    "\\usepackage{amsmath}",
    "\\usepackage{tikz}",
    supportSource,
    options.preambleSource?.trim(),
    "\\begin{document}",
    tikz.trimEnd(),
    "\\end{document}"
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

/** Normalize line endings so SVG golden tests stay stable. */
function normalizeSvg(svg: string): string {
  const normalized = svg
    .replace(/\r\n/g, "\n")
    .replace(/^\s*<\?xml[^>]*>\s*/i, "")
    .replace(/^<!--.*?-->\s*/s, "")
    .trim();

  return `${normalized}\n`;
}

function extractUsedFontFamilies(svg: string): string[] {
  const families = new Set<string>();

  for (const match of svg.matchAll(/font-family="([^"]+)"/g)) {
    const family = match[1];
    if (family) {
      families.add(family);
    }
  }

  for (const match of svg.matchAll(/font-family='([^']+)'/g)) {
    const family = match[1];
    if (family) {
      families.add(family);
    }
  }

  return [...families].sort();
}

function buildEmbeddedFontCss(fontFamilies: string[]): string {
  const key = fontFamilies.join("|");
  const cached = embeddedFontCssCache.get(key);
  if (cached) {
    return cached;
  }

  const rules: string[] = [];

  for (const family of fontFamilies) {
    const escapedFamily = family.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const ruleMatch = nodeTikzJaxFontsCssSource.match(
      new RegExp(`@font-face\\s*\\{\\s*font-family:\\s*${escapedFamily};\\s*src:\\s*url\\('([^']+)'\\);\\s*\\}`)
    );

    if (!ruleMatch) {
      continue;
    }

    const fontPath = new URL(`../../../node_modules/node-tikzjax/css/${ruleMatch[1]}`, import.meta.url);
    const fontBase64 = readFileSync(fontPath).toString("base64");
    rules.push(`@font-face{font-family:${family};src:url(data:font/ttf;base64,${fontBase64}) format('truetype');}`);
  }

  const css = rules.join("");
  embeddedFontCssCache.set(key, css);
  return css;
}

function inlineEmbeddedFontCss(svg: string): string {
  const fontFamilies = extractUsedFontFamilies(svg);
  if (fontFamilies.length === 0) {
    return svg;
  }

  const embeddedCss = buildEmbeddedFontCss(fontFamilies);
  if (embeddedCss.length === 0) {
    return svg;
  }

  const styleBlock = `<style>${embeddedCss}</style>`;

  if (svg.includes("<defs><style>@import url(")) {
    return svg.replace(/<defs><style>@import url\([^)]*\);<\/style><\/defs>/, `<defs>${styleBlock}</defs>`);
  }

  if (svg.includes("<defs>")) {
    return svg.replace("<defs>", `<defs>${styleBlock}`);
  }

  return svg.replace(/<svg\b([^>]*)>/, `<svg$1><defs>${styleBlock}</defs>`);
}

function commandMissing(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "ENOENT"
  );
}

/** Unwrap the default-export shape used by node-tikzjax across module formats. */
function resolveTex2Svg(module: unknown): (input: string, options?: { embedFontCss?: boolean }) => Promise<string> {
  let current = module;

  while (current && typeof current !== "function" && typeof current === "object" && "default" in current) {
    current = current.default;
  }

  if (typeof current !== "function") {
    throw new Error("unable to load node-tikzjax renderer");
  }

  return current as (input: string, options?: { embedFontCss?: boolean }) => Promise<string>;
}

/** Render a TikZ snippet into SVG via the browser-compatible node-tikzjax path. */
async function renderTikzToSvgWithNodeTikzJax(tikz: string, options: SvgRenderOptions = {}): Promise<string> {
  const module = await import("node-tikzjax");
  const tex2svg = resolveTex2Svg(module);
  const svg = await tex2svg(
    [
      "\\usepackage{amsmath}",
      "\\usepackage{tikz}",
      supportSource,
      options.preambleSource?.trim(),
      "\\begin{document}",
      tikz.trimEnd(),
      "\\end{document}"
    ]
      .filter((line): line is string => Boolean(line))
      .join("\n"),
    {
      embedFontCss: true
    }
  );
  return normalizeSvg(inlineEmbeddedFontCss(svg));
}

/** Render a TikZ snippet into SVG via latex + dvisvgm for TeX-quality math outlines. */
function renderTikzToSvgWithDvisvgm(tikz: string, options: SvgRenderOptions = {}): string {
  const tempDir = mkdtempSync(join(tmpdir(), "fgz-svg-"));
  const texPath = join(tempDir, "figure.tex");
  const dviPath = join(tempDir, "figure.dvi");
  const svgPath = join(tempDir, "figure.svg");

  try {
    writeFileSync(texPath, buildStandaloneTexDocument(tikz, options), "utf8");
    execFileSync("latex", ["-interaction=nonstopmode", "-halt-on-error", "figure.tex"], {
      cwd: tempDir,
      stdio: "pipe"
    });
    execFileSync("dvisvgm", ["--bbox=papersize", "--no-fonts", dviPath, "-o", svgPath], {
      cwd: tempDir,
      stdio: "pipe"
    });
    return normalizeSvg(readFileSync(svgPath, "utf8"));
  } catch (error) {
    if (error instanceof Error && "stderr" in error) {
      const stderr = (error as { stderr?: Buffer | string }).stderr;
      const stdout = (error as { stdout?: Buffer | string }).stdout;
      const details = [stdout, stderr]
        .flatMap((value) => (value ? [typeof value === "string" ? value : value.toString("utf8")] : []))
        .join("\n")
        .trim();
      throw new Error(details ? `SVG render failed\n${details}` : "SVG render failed");
    }
    throw error;
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

/** Render a TikZ snippet into SVG. */
export async function renderTikzToSvg(tikz: string, options: SvgRenderOptions = {}): Promise<string> {
  const backend = options.backend ?? "browser";

  if (backend === "native") {
    try {
      return renderTikzToSvgWithDvisvgm(tikz, options);
    } catch (error) {
      if (!commandMissing(error)) {
        throw error;
      }
      throw new Error('SVG backend "native" requires both `latex` and `dvisvgm`');
    }
  }

  return renderTikzToSvgWithNodeTikzJax(tikz, options);
}

/** Render a validated fgz document into SVG via the shared TikZ pipeline. */
export async function renderDocumentToSvg(doc: Document, options: SvgRenderOptions = {}): Promise<string> {
  return renderTikzToSvg(toTikz(doc), options);
}
