#!/usr/bin/env node

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultPdfOutputPath, reportCliError, runCli, usage } from "./cli.js";
import { renderDocumentToPdf } from "./pdf.js";

const usageText = usage("fgz2pdf", "pdf", { allowMacros: true, extra: "[--keep-temp]" });

function extractKeepTemp(argv: string[]): { filteredArgv: string[]; keepTemp: boolean } {
  const filteredArgv: string[] = [];
  let keepTemp = false;

  for (const arg of argv) {
    if (arg === "--keep-temp") {
      keepTemp = true;
      continue;
    }
    filteredArgv.push(arg);
  }

  return { filteredArgv, keepTemp };
}

/** CLI entrypoint for fgz2pdf. */
export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const { filteredArgv, keepTemp } = extractKeepTemp(argv);
  await runCli(
    filteredArgv,
    defaultPdfOutputPath,
    (doc, context) =>
      renderDocumentToPdf(doc, {
        ...(context.macroSource ? { macroSource: context.macroSource } : {}),
        keepTemp
      }),
    { allowMacros: true }
  );
}

const invokedPath = process.argv[1];
if (invokedPath && fileURLToPath(import.meta.url) === resolve(invokedPath)) {
  main().catch((error: unknown) => {
    reportCliError(error, usageText);
    process.exitCode = 1;
  });
}
