#!/usr/bin/env node

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { reportCliError, runCli, defaultSvgOutputPath, usage } from "./cli.js";
import { renderDocumentToSvg } from "./svg.js";

const usageText = usage("fgz2svg", "svg", { allowPreamble: true });

/** CLI entrypoint for fgz2svg. */
export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  await runCli(
    argv,
    defaultSvgOutputPath,
    (doc, context) => renderDocumentToSvg(doc, context.preambleSource ? { preambleSource: context.preambleSource } : {}),
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
