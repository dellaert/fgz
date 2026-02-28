import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { defaultSvgOutputPath, runCli } from "../src/cli.js";

describe("runCli", () => {
  it("passes explicit preamble sources to renderers when --preamble is provided", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "fgz-cli-"));

    try {
      const inputPath = join(tempDir, "input.fgz");
      const preamblePath = join(tempDir, "preamble.tex");
      writeFileSync(
        inputPath,
        `fgz 1
variable x (0, 0)
`,
        "utf8"
      );
      writeFileSync(preamblePath, "\\newcommand{\\twist}{\\mathcal{V}}\n", "utf8");

      await runCli(
        [inputPath, "--preamble", preamblePath],
        defaultSvgOutputPath,
        (_doc, context) => context.preambleSource ?? "",
        { allowPreamble: true }
      );

      expect(readFileSync(join(tempDir, "input.svg"), "utf8")).toContain("\\newcommand{\\twist}{\\mathcal{V}}");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
