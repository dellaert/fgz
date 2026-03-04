#!/usr/bin/env node

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { reportCliError, runCli, defaultSvgOutputPath, usage } from "./cli.js";
import { renderDocumentToSvg } from "./svg.js";

const usageText = usage("fgz2svg", "svg", { allowPreamble: true, extra: "[--backend browser|native]" });

function parseSvgBackendArg(argv: string[]): { argv: string[]; backend: "browser" | "native" } {
  const filtered: string[] = [];
  let backend: "browser" | "native" = "browser";

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg) {
      continue;
    }

    if (arg === "--backend") {
      const next = argv[index + 1];
      if (next !== "browser" && next !== "native") {
        throw new Error('missing or invalid value for --backend (expected "browser" or "native")');
      }
      backend = next;
      index += 1;
      continue;
    }

    filtered.push(arg);
  }

  return { argv: filtered, backend };
}

/** CLI entrypoint for fgz2svg. */
export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const parsed = parseSvgBackendArg(argv);
  await runCli(
    parsed.argv,
    defaultSvgOutputPath,
    (doc, context) =>
      renderDocumentToSvg(doc, {
        ...(context.preambleSource ? { preambleSource: context.preambleSource } : {}),
        backend: parsed.backend
      }),
    { allowPreamble: true }
  );
}

const invokedPath = process.argv[1];
if (invokedPath && fileURLToPath(import.meta.url) === resolve(invokedPath)) {
  main().catch((error: unknown) => {
    reportCliError(error, usageText);
    process.exitCode = 1;
  });
}
