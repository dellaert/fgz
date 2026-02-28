import { readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { FgzError, parseFgz } from "../../fgz-core/dist/index.js";
import type { Document } from "../../fgz-core/dist/index.js";

export interface CliOptions {
  inputPath: string;
  outputPath: string;
  macrosPath?: string;
}

export interface CliRenderContext {
  inputPath: string;
  inputDir: string;
  outputPath: string;
  macrosPath?: string;
  macroSource?: string;
}

type RenderedOutput = string | Uint8Array;
type Renderer = (doc: Document, context: CliRenderContext) => Promise<RenderedOutput> | RenderedOutput;

interface ParseArgsConfig {
  defaultOutputPath: (inputPath: string) => string;
  allowMacros?: boolean;
}

/** Build a concise usage string for a CLI entrypoint. */
export function usage(command: string, extension: string, options: { allowMacros?: boolean; extra?: string } = {}): string {
  const parts = [`usage: ${command} <input.fgz> [-o <output.${extension}>]`];
  if (options.allowMacros) {
    parts.push("[--macros <macros.tex>]");
  }
  if (options.extra) {
    parts.push(options.extra);
  }
  return parts.join(" ");
}

/** Parse common CLI arguments shared by the fgz command-line tools. */
function parseArgs(argv: string[], config: ParseArgsConfig): CliOptions {
  let inputPath: string | undefined;
  let outputPath: string | undefined;
  let macrosPath: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg) {
      continue;
    }
    if (arg === "-o") {
      const next = argv[index + 1];
      if (!next) {
        throw new Error("missing value for -o");
      }
      outputPath = next;
      index += 1;
      continue;
    }
    if (arg === "--macros") {
      if (!config.allowMacros) {
        throw new Error('unknown option "--macros"');
      }
      const next = argv[index + 1];
      if (!next) {
        throw new Error("missing value for --macros");
      }
      macrosPath = next;
      index += 1;
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`unknown option "${arg}"`);
    }

    if (inputPath) {
      throw new Error("expected a single input file");
    }

    inputPath = arg;
  }

  if (!inputPath) {
    throw new Error("missing input file");
  }

  return {
    inputPath,
    outputPath: outputPath ?? config.defaultOutputPath(inputPath),
    ...(macrosPath ? { macrosPath } : {})
  };
}

/** Compute the default `.fgz.tex` output path for a source file. */
export function defaultTexOutputPath(inputPath: string): string {
  return `${inputPath}.tex`;
}

/** Compute the default `.svg` output path for a source file. */
export function defaultSvgOutputPath(inputPath: string): string {
  return extname(inputPath) === ".fgz" ? `${inputPath.slice(0, -4)}.svg` : `${inputPath}.svg`;
}

/** Compute the default `.fgz.pdf` output path for a source file. */
export function defaultPdfOutputPath(inputPath: string): string {
  return `${inputPath}.pdf`;
}

/** Read an fgz file, render it, and write the output path selected by CLI arguments. */
export async function runCli(
  argv: string[],
  defaultOutputPath: (inputPath: string) => string,
  render: Renderer,
  options: { allowMacros?: boolean } = {}
): Promise<void> {
  const parsed = parseArgs(argv, {
    defaultOutputPath,
    ...(options.allowMacros !== undefined ? { allowMacros: options.allowMacros } : {})
  });
  const inputPath = resolve(parsed.inputPath);
  const outputPath = resolve(parsed.outputPath);
  const macrosPath = parsed.macrosPath ? resolve(parsed.macrosPath) : undefined;
  const source = readFileSync(inputPath, "utf8");
  const doc = parseFgz(source);
  // Macro preambles are opt-in so SVG and PDF exports stay explicit and reproducible.
  const macroSource = macrosPath ? readFileSync(macrosPath, "utf8") : undefined;
  const rendered = await render(doc, {
    inputPath,
    inputDir: dirname(inputPath),
    outputPath,
    ...(macrosPath ? { macrosPath } : {}),
    ...(macroSource ? { macroSource } : {})
  });
  writeFileSync(outputPath, rendered);
}

/** Print a user-friendly CLI error and matching usage string. */
export function reportCliError(error: unknown, usageText: string): void {
  if (error instanceof FgzError) {
    console.error(error.message);
    return;
  }

  if (error instanceof Error) {
    console.error(error.message);
    console.error(usageText);
    return;
  }

  console.error(String(error));
}
