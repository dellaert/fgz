#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFgz, toTikz } from "../../fgz-core/dist/index.js";
import { FgzError } from "../../fgz-core/dist/index.js";

interface CliOptions {
  inputPath: string;
  outputPath: string;
}

function usage(): string {
  return "usage: fgz2tex <input.fgz> [-o <output.tex>]";
}

function parseArgs(argv: string[]): CliOptions {
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
    outputPath: outputPath ?? `${inputPath}.tex`
  };
}

/**
 * CLI entrypoint for fgz2tex.
 */
export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const options = parseArgs(argv);
  const inputPath = resolve(options.inputPath);
  const outputPath = resolve(options.outputPath);
  const source = readFileSync(inputPath, "utf8");
  const doc = parseFgz(source);
  const tikz = toTikz(doc);
  writeFileSync(outputPath, tikz, "utf8");
}

const invokedPath = process.argv[1];
if (invokedPath && fileURLToPath(import.meta.url) === resolve(invokedPath)) {
  main().catch((error: unknown) => {
    if (error instanceof FgzError) {
      console.error(error.message);
    } else if (error instanceof Error) {
      console.error(error.message);
      console.error(usage());
    } else {
      console.error(String(error));
    }
    process.exitCode = 1;
  });
}
