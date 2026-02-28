import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const examplesDir = "examples";
const svgOnly = process.argv.includes("--svg-only");
const fgzFiles = readdirSync(examplesDir)
  .filter((name) => name.endsWith(".fgz"))
  .sort();

for (const file of fgzFiles) {
  execFileSync("node", ["packages/fgz-cli/dist/fgz2tex.js", join(examplesDir, file)], {
    stdio: "inherit"
  });
  execFileSync("node", ["packages/fgz-cli/dist/fgz2svg.js", join(examplesDir, file), "--macros", join(examplesDir, "macro.tex")], {
    stdio: "inherit"
  });
}

if (svgOnly) {
  process.exit(0);
}

for (let pass = 0; pass < 2; pass += 1) {
  execFileSync(
    "pdflatex",
    ["-interaction=nonstopmode", "-halt-on-error", "-output-directory", examplesDir, join(examplesDir, "examples.tex")],
    {
      stdio: "inherit"
    }
  );
}
