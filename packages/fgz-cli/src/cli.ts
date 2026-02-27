import { readFileSync, writeFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { FgzError, parseFgz } from "../../fgz-core/dist/index.js";
import type { Document } from "../../fgz-core/dist/index.js";

export interface CliOptions {
  inputPath: string;
  outputPath: string;
}

type Renderer = (doc: Document) => Promise<string> | string;

export function usage(command: string, extension: string): string {
  return `usage: ${command} <input.fgz> [-o <output.${extension}>]`;
}

function parseArgs(argv: string[], defaultOutputPath: (inputPath: string) => string): CliOptions {
  let inputPath: string | undefined;
  let outputPath: string | undefined;

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
    outputPath: outputPath ?? defaultOutputPath(inputPath)
  };
}

export function defaultTexOutputPath(inputPath: string): string {
  return `${inputPath}.tex`;
}

export function defaultSvgOutputPath(inputPath: string): string {
  return extname(inputPath) === ".fgz" ? `${inputPath.slice(0, -4)}.svg` : `${inputPath}.svg`;
}

/** Read an fgz file, render it, and write the output path selected by CLI arguments. */
export async function runCli(
  argv: string[],
  defaultOutputPath: (inputPath: string) => string,
  render: Renderer
): Promise<void> {
  const options = parseArgs(argv, defaultOutputPath);
  const inputPath = resolve(options.inputPath);
  const outputPath = resolve(options.outputPath);
  const source = readFileSync(inputPath, "utf8");
  const doc = parseFgz(source);
  const rendered = await render(doc);
  writeFileSync(outputPath, rendered, "utf8");
}

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
