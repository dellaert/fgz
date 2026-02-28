import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { defaultSvgOutputPath, runCli } from "../src/cli.js";

describe("runCli", () => {
  it("passes explicit macro sources to renderers when --macros is provided", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "fgz-cli-"));

    try {
      const inputPath = join(tempDir, "input.fgz");
      const macrosPath = join(tempDir, "macros.tex");
      writeFileSync(
        inputPath,
        `fgz 1
variable x (0, 0)
`,
        "utf8"
      );
      writeFileSync(macrosPath, "\\newcommand{\\twist}{\\mathcal{V}}\n", "utf8");

      await runCli(
        [inputPath, "--macros", macrosPath],
        defaultSvgOutputPath,
        (_doc, context) => context.macroSource ?? "",
        { allowMacros: true }
      );

      expect(readFileSync(join(tempDir, "input.svg"), "utf8")).toContain("\\newcommand{\\twist}{\\mathcal{V}}");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
