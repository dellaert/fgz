import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { toTikz } from "../../fgz-core/dist/index.js";
import type { Document } from "../../fgz-core/dist/index.js";

const supportSource = readFileSync(new URL("../../../tikz/fgz.tikz.tex", import.meta.url), "utf8").trim();

export interface PdfRenderOptions {
  macroSource?: string;
  keepTemp?: boolean;
}

function buildStandaloneTexDocument(tikz: string, options: PdfRenderOptions = {}): string {
  return [
    "\\documentclass[tikz,border=2pt]{standalone}",
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

function normalizePdf(buffer: Buffer): Buffer {
  return buffer;
}

/** Render a TikZ snippet into a standalone PDF via pdflatex. */
export function renderTikzToPdf(tikz: string, options: PdfRenderOptions = {}): Buffer {
  const tempDir = mkdtempSync(join(tmpdir(), "fgz-pdf-"));
  const texPath = join(tempDir, "figure.tex");
  const pdfPath = join(tempDir, "figure.pdf");

  try {
    writeFileSync(texPath, buildStandaloneTexDocument(tikz, options), "utf8");
    execFileSync("pdflatex", ["-interaction=nonstopmode", "-halt-on-error", "figure.tex"], {
      cwd: tempDir,
      stdio: "pipe"
    });
    return normalizePdf(readFileSync(pdfPath));
  } catch (error) {
    if (error instanceof Error && "stderr" in error) {
      const stderr = (error as { stderr?: Buffer | string }).stderr;
      const stdout = (error as { stdout?: Buffer | string }).stdout;
      const details = [stdout, stderr]
        .flatMap((value) => (value ? [typeof value === "string" ? value : value.toString("utf8")] : []))
        .join("\n")
        .trim();
      const suffix = options.keepTemp ? `; temp files kept at ${tempDir}` : "";
      throw new Error(details ? `pdflatex failed${suffix}\n${details}` : `pdflatex failed${suffix}`);
    }
    throw error;
  } finally {
    if (!options.keepTemp) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

/** Render a validated fgz document into a standalone PDF via the shared TikZ pipeline. */
export function renderDocumentToPdf(doc: Document, options: PdfRenderOptions = {}): Buffer {
  return renderTikzToPdf(toTikz(doc), options);
}
